import fs from "node:fs/promises";
import path from "node:path";
import { runEvals } from "../core/EvalRunner.js";
import { replayRun } from "../core/Replay.js";
import type { RaxRuntime } from "../core/RaxRuntime.js";
import { collectLocalEvidence, formatLocalEvidence } from "../evidence/LocalEvidenceCollector.js";
import { LearningMetricsStore } from "../learning/LearningMetrics.js";
import { LearningProposalGenerator } from "../learning/LearningProposalGenerator.js";
import { LearningQueue } from "../learning/LearningQueue.js";
import { LearningRecorder } from "../learning/LearningRecorder.js";
import { MemoryStore } from "../memory/MemoryStore.js";
import type { RaxMode } from "../schemas/Config.js";
import { ThreadStore, type ChatThread } from "./ThreadStore.js";

export type ChatTurnResult = {
  output: string;
  shouldExit?: boolean;
};

const VALID_MODES: RaxMode[] = [
  "intake",
  "analysis",
  "planning",
  "audit",
  "stax_fitness",
  "code_review",
  "teaching",
  "general_chat",
  "project_brain",
  "codex_audit",
  "prompt_factory",
  "test_gap_audit",
  "policy_drift",
  "learning_unit"
];

export class ChatSession {
  private context: string[] = [];
  private modeOverride: RaxMode | undefined;
  private workspace = "default";
  private runIds: string[] = [];
  private lastAssistantOutput = "";
  private threadId = "thread_default";
  private thread?: ChatThread;
  private threadStore: ThreadStore;

  constructor(
    private runtime: RaxRuntime,
    private memoryStore = new MemoryStore(),
    private rootDir = process.cwd()
  ) {
    this.threadStore = new ThreadStore(rootDir);
  }

  async handleLine(line: string): Promise<ChatTurnResult> {
    const input = line.trim();
    await this.ensureThread();
    if (!input) return { output: "" };
    if (input.startsWith("/")) {
      return this.handleCommand(input);
    }

    const output = await this.run(input, this.modeOverride ?? this.inferChatMode(input));
    return { output };
  }

  async headerText(): Promise<string> {
    const thread = await this.ensureThread();
    return [
      "STAX Chat",
      `Workspace: ${this.workspace}`,
      `Thread: ${thread.threadId}`,
      `Mode: ${this.modeOverride ?? "auto"}`,
      "Type /help for commands, /exit to exit."
    ].join("\n");
  }

  private async handleCommand(commandLine: string): Promise<ChatTurnResult> {
    const [command = "", ...rest] = commandLine.split(/\s+/);
    const arg = rest.join(" ").trim();

    if (command === "/quit" || command === "/exit") {
      return { output: "bye", shouldExit: true };
    }

    if (command === "/help") {
      return { output: this.helpText() };
    }

    if (command === "/mode") {
      if (!arg) {
        return { output: `mode: ${this.modeOverride ?? "auto"}` };
      }
      if (arg === "auto") {
        this.modeOverride = undefined;
        this.thread = await this.threadStore.updateMode(this.threadId, "auto");
        return { output: "mode: auto" };
      }
      if (!VALID_MODES.includes(arg as RaxMode)) {
        return { output: `Unknown mode: ${arg}\nValid modes: ${VALID_MODES.join(", ")}` };
      }
      this.modeOverride = arg as RaxMode;
      this.thread = await this.threadStore.updateMode(this.threadId, this.modeOverride);
      return { output: `mode: ${this.modeOverride}` };
    }

    if (command === "/project") {
      if (!arg) return { output: `project: ${this.workspace}` };
      this.workspace = arg;
      this.thread = await this.threadStore.updateWorkspace(this.threadId, this.workspace);
      this.context.push(`Workspace: ${this.workspace}`);
      return { output: `project: ${this.workspace}` };
    }

    if (command === "/status") {
      return { output: await this.statusSummary() };
    }

    if (command === "/thread") {
      const thread = await this.ensureThread();
      return {
        output: [
          `Thread: ${thread.threadId}`,
          `Title: ${thread.title}`,
          `Workspace: ${thread.workspace}`,
          `Mode: ${thread.mode}`,
          `Messages: ${thread.messages.length}`,
          `LinkedRuns: ${thread.linkedRuns.length}`,
          `LinkedLearningEvents: ${thread.linkedLearningEvents.length}`
        ].join("\n")
      };
    }

    if (command === "/new") {
      const title = arg || "New Chat";
      this.thread = await this.threadStore.create({ title, workspace: this.workspace, mode: "auto" });
      this.threadId = this.thread.threadId;
      this.modeOverride = undefined;
      this.context = [];
      this.runIds = [];
      this.lastAssistantOutput = "";
      return { output: `new thread: ${this.thread.threadId}` };
    }

    if (command === "/clear") {
      this.context = [];
      this.lastAssistantOutput = "";
      return { output: "Active chat context cleared. Thread history and learning artifacts were kept." };
    }

    if (command === "/compact") {
      return { output: await this.createThreadSummaryCandidate() };
    }

    if (command === "/runs") {
      return {
        output: this.runIds.length ? this.runIds.map((runId) => `- ${runId}`).join("\n") : "- No chat runs yet."
      };
    }

    if (command === "/last") {
      const runId = this.runIds.at(-1);
      if (!runId) return { output: "No chat run is available to show." };
      return { output: await this.showRun(runId) };
    }

    if (command === "/show") {
      const runId = arg && arg !== "last" ? arg : this.runIds.at(-1);
      if (!runId) return { output: "No chat run is available to show." };
      return { output: await this.showRun(runId) };
    }

    if (command === "/queue") {
      return { output: await this.queueSummary() };
    }

    if (command === "/metrics") {
      return { output: await this.metricsSummary() };
    }

    if (command === "/learn") {
      const [learnAction = "", learnArg = ""] = arg.split(/\s+/);
      if (arg === "last") {
        const runId = this.runIds.at(-1);
        if (!runId) return { output: "No chat run is available to analyze." };
        const output = await this.run(`Analyze run ${runId} and propose how STAX should improve from it.`, "learning_unit");
        return { output };
      }
      if (learnAction === "queue") {
        return { output: await this.queueSummary() };
      }
      if (learnAction === "metrics") {
        return { output: await this.metricsSummary() };
      }
      if (learnAction === "inspect" && learnArg) {
        return { output: await this.inspectLearningEvent(learnArg) };
      }
      if (learnAction === "propose" && learnArg === "last") {
        const runId = this.runIds.at(-1);
        if (!runId) return { output: "No chat run is available to propose from." };
        const event = JSON.parse(await fs.readFile(path.join(await this.findRunDir(runId), "learning_event.json"), "utf8"));
        const proposal = await new LearningProposalGenerator(this.rootDir).generate(event);
        return { output: proposal ? JSON.stringify(proposal, null, 2) : "No proposal needed for trace-only event." };
      }
      return { output: "Usage: /learn last | queue | metrics | inspect <event-id> | propose last" };
    }

    if (command === "/eval" || command === "/regression") {
      const folder = command === "/regression" ? "regression" : "cases";
      const result = await runEvals({ rootDir: this.rootDir, folder });
      await new LearningRecorder(this.rootDir).recordCommand({
        commandName: command === "/regression" ? "chat regression" : "chat eval",
        argsSummary: command,
        success: result.failed === 0 && result.criticalFailures === 0,
        outputSummary: JSON.stringify(result),
        exitStatus: result.failed === 0 && result.criticalFailures === 0 ? 0 : 1
      });
      return {
        output: [
          `${command === "/regression" ? "Regression" : "Eval"}: ${result.passed}/${result.total}`,
          `passRate: ${result.passRate}`,
          `criticalFailures: ${result.criticalFailures}`
        ].join("\n")
      };
    }

    if (command === "/replay") {
      const runId = arg === "last" || !arg ? this.runIds.at(-1) : arg;
      if (!runId) return { output: "No chat run is available to replay." };
      try {
        const result = await replayRun({ rootDir: this.rootDir, runId });
        await new LearningRecorder(this.rootDir).recordCommand({
          commandName: "chat replay",
          argsSummary: `/replay ${runId}`,
          success: result.exact,
          outputSummary: JSON.stringify(result),
          exitStatus: result.exact ? 0 : 1,
          artifactPaths: [result.replayRunId],
          runId
        });
        return {
          output: [
            `Replay: ${result.exact ? "exact" : "drift detected"}`,
            `OriginalRun: ${result.originalRunId}`,
            `ReplayRun: ${result.replayRunId}`,
            `OutputExact: ${result.outputExact}`,
            `TraceExact: ${result.traceExact}`,
            `Reason: ${result.reason ?? "none"}`
          ].join("\n")
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await new LearningRecorder(this.rootDir).recordCommand({
          commandName: "chat replay",
          argsSummary: `/replay ${runId}`,
          success: false,
          outputSummary: message,
          exitStatus: 1,
          runId
        });
        return { output: `Replay failed: ${message}` };
      }
    }

    if (command === "/audit-last") {
      if (!this.lastAssistantOutput) {
        return { output: "No assistant output to audit yet." };
      }
      const output = await this.run(this.lastAssistantOutput, "codex_audit");
      return { output };
    }

    if (command === "/state") {
      const evidence = await collectLocalEvidence(this.rootDir, {
        includeProjectDocs: true,
        includeModeMaturity: true
      });
      const output = await this.run(
        ["Project Brain local state review.", formatLocalEvidence(evidence)].join("\n\n"),
        "project_brain"
      );
      return { output };
    }

    if (command === "/prompt") {
      if (!arg) return { output: "Usage: /prompt <task>" };
      const output = await this.run(arg, "prompt_factory");
      return { output };
    }

    if (command === "/test-gap") {
      if (!arg) return { output: "Usage: /test-gap <feature>" };
      const output = await this.run(arg, "test_gap_audit");
      return { output };
    }

    if (command === "/policy-drift") {
      if (!arg) return { output: "Usage: /policy-drift <change>" };
      const output = await this.run(arg, "policy_drift");
      return { output };
    }

    if (command === "/remember") {
      if (!arg) {
        return { output: 'Usage: /remember "approved fact to review"' };
      }
      const record = await this.memoryStore.add({
        type: "project",
        content: arg,
        confidence: "medium",
        approved: false,
        tags: ["chat", this.workspace]
      });
      return {
        output: [
          "Pending memory created. It will not be retrieved until approved.",
          `id: ${record.id}`,
          `approve: rax memory approve ${record.id}`
        ].join("\n")
      };
    }

    if (command === "/memory") {
      if (!arg.startsWith("search ")) {
        return { output: 'Usage: /memory search "query"' };
      }
      const query = arg.replace(/^search\s+/, "");
      const results = await this.memoryStore.search(query);
      return {
        output: results.length
          ? results.map((item) => `- ${item.id} [${item.type}]: ${item.content}`).join("\n")
          : "- No approved memory matched."
      };
    }

    return { output: `Unknown command: ${command}\n${this.helpText()}` };
  }

  private async run(input: string, mode?: RaxMode): Promise<string> {
    await this.ensureThread();
    const result = await this.runtime.run(input, [`Workspace: ${this.workspace}`, ...this.context], { mode });
    const runDir = await this.findRunDir(result.runId);
    const trace = JSON.parse(await fs.readFile(path.join(runDir, "trace.json"), "utf8")) as {
      learningEventId?: string;
      learningQueues?: string[];
      mode?: string;
      validation?: { valid?: boolean };
    };
    this.runIds.push(result.runId);
    this.lastAssistantOutput = result.output;
    this.context.push(`User: ${input}`);
    this.context.push(`RAX: ${result.output}`);
    this.context = this.context.slice(-12);
    const learningEventId = trace.learningEventId;
    await this.threadStore.appendMessage(this.threadId, {
      role: "user",
      content: input,
      runId: result.runId,
      learningEventId
    });
    this.thread = await this.threadStore.appendMessage(this.threadId, {
      role: "assistant",
      content: result.output,
      runId: result.runId,
      learningEventId
    });
    return [
      result.output,
      "",
      `Run: ${result.runId}`,
      `Mode: ${result.taskMode}`,
      ...(this.modeOverride ? [`ModeOverride: ${this.modeOverride}`] : []),
      `LearningEvent: ${learningEventId ?? "none"}`,
      `Queues: ${trace.learningQueues?.join(", ") || "none"}`,
      `Trace: ${path.relative(this.rootDir, path.join(runDir, "trace.json"))}`
    ].join("\n");
  }

  private inferChatMode(input: string): RaxMode | undefined {
    if (/\b(what are we doing next|what next|where are we|project state|current state)\b/i.test(input)) {
      return "project_brain";
    }
    if (/\b(codex says|audit codex|codex report)\b/i.test(input)) {
      return "codex_audit";
    }
    if (/\b(codex prompt|make a prompt|write a prompt)\b/i.test(input)) {
      return "prompt_factory";
    }
    if (/\b(test gap|missing tests)\b/i.test(input)) {
      return "test_gap_audit";
    }
    if (/\b(policy drift|unsafe config|shell=allowed|filewrite=allowed)\b/i.test(input)) {
      return "policy_drift";
    }
    if (/\b(learning unit|approved learning loop|learning event|learning queue|improve over time|adapt over time)\b/i.test(input)) {
      return "learning_unit";
    }
    return undefined;
  }

  private async showRun(runId: string): Promise<string> {
    const runDir = await this.findRunDir(runId);
    const final = await fs.readFile(path.join(runDir, "final.md"), "utf8");
    const trace = JSON.parse(await fs.readFile(path.join(runDir, "trace.json"), "utf8")) as {
      mode?: string;
      validation?: { valid?: boolean };
      learningEventId?: string;
      learningQueues?: string[];
    };
    return [
      final.trim(),
      "",
      `Run: ${runId}`,
      `Mode: ${trace.mode ?? "unknown"}`,
      `Validation: ${trace.validation?.valid === false ? "failed" : "passed"}`,
      `LearningEvent: ${trace.learningEventId ?? "none"}`,
      `LearningQueues: ${trace.learningQueues?.join(", ") || "none"}`,
      `Trace: ${path.relative(this.rootDir, path.join(runDir, "trace.json"))}`
    ].join("\n");
  }

  private async inspectLearningEvent(eventId: string): Promise<string> {
    const file = path.join(this.rootDir, "learning", "events", "hot", `${eventId}.json`);
    return fs.readFile(file, "utf8");
  }

  private async queueSummary(): Promise<string> {
    const items = await new LearningQueue(this.rootDir).list();
    if (items.length === 0) return "- No learning queue items.";

    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.queueType, (counts.get(item.queueType) ?? 0) + 1);
    }
    const recent = items
      .slice(-10)
      .reverse()
      .map((item) => `- [${item.queueType}] ${item.eventId} (${item.reason})`);

    return [
      `Learning Queue: ${items.length} item${items.length === 1 ? "" : "s"}`,
      "By Type:",
      ...Array.from(counts.entries()).map(([type, count]) => `- ${type}: ${count}`),
      "",
      `Recent${items.length > 10 ? " (latest 10)" : ""}:`,
      ...recent,
      "",
      "Use /learn inspect <event-id> for the full event."
    ].join("\n");
  }

  private async statusSummary(): Promise<string> {
    const thread = await this.ensureThread();
    const queueItems = await new LearningQueue(this.rootDir).list();
    const metrics = await new LearningMetricsStore(this.rootDir).read();
    const queueCounts = new Map<string, number>();
    for (const item of queueItems) {
      queueCounts.set(item.queueType, (queueCounts.get(item.queueType) ?? 0) + 1);
    }
    const queueLines = queueCounts.size
      ? Array.from(queueCounts.entries()).map(([type, count]) => `- ${type}: ${count}`)
      : ["- none"];
    return [
      "STAX Chat Status",
      `Workspace: ${this.workspace}`,
      `Thread: ${thread.threadId}`,
      `Mode: ${this.modeOverride ?? "auto"}`,
      `LatestRun: ${this.runIds.at(-1) ?? "none"}`,
      `LatestLearningEvent: ${thread.linkedLearningEvents.at(-1) ?? "none"}`,
      `Messages: ${thread.messages.length}`,
      `ActiveContextItems: ${this.context.length}`,
      "",
      "Queue Counts:",
      ...queueLines,
      "",
      "Learning Metrics:",
      `learningEventsCreated: ${metrics.learningEventsCreated}`,
      `genericOutputRate: ${metrics.genericOutputRate}`,
      `planningSpecificityScore: ${metrics.planningSpecificityScore}`
    ].join("\n");
  }

  private async metricsSummary(): Promise<string> {
    const metrics = await new LearningMetricsStore(this.rootDir).read();
    return [
      "Learning Metrics:",
      `learningEventsCreated: ${metrics.learningEventsCreated}`,
      `totalRuns: ${metrics.totalRuns}`,
      `genericOutputRate: ${metrics.genericOutputRate}`,
      `criticFailureRate: ${metrics.criticFailureRate}`,
      `schemaFailureRate: ${metrics.schemaFailureRate}`,
      `evalFailureRate: ${metrics.evalFailureRate}`,
      `candidateApprovalRate: ${metrics.candidateApprovalRate}`,
      `candidateRejectionRate: ${metrics.candidateRejectionRate}`,
      `planningSpecificityScore: ${metrics.planningSpecificityScore}`
    ].join("\n");
  }

  private async createThreadSummaryCandidate(): Promise<string> {
    const thread = await this.ensureThread();
    if (thread.messages.length === 0) {
      return "No thread messages to compact.";
    }
    const createdAt = new Date().toISOString();
    const candidateId = `summary_${createdAt.replace(/[^0-9]/g, "").slice(0, 17)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const recentMessages = thread.messages.slice(-12).map((message) => {
      const compactContent = message.content.replace(/\s+/g, " ").trim().slice(0, 280);
      const links = [message.runId ? `run=${message.runId}` : undefined, message.learningEventId ? `event=${message.learningEventId}` : undefined]
        .filter(Boolean)
        .join(", ");
      return `- ${message.role}: ${compactContent}${links ? ` (${links})` : ""}`;
    });
    const content = [
      "# Chat Summary Candidate",
      "",
      `Candidate: ${candidateId}`,
      `Thread: ${thread.threadId}`,
      `Workspace: ${thread.workspace}`,
      `Mode: ${thread.mode}`,
      `CreatedAt: ${createdAt}`,
      "",
      "## Recent Messages",
      ...recentMessages,
      "",
      "## Linked Runs",
      ...(thread.linkedRuns.length ? thread.linkedRuns.slice(-12).map((runId) => `- ${runId}`) : ["- none"]),
      "",
      "## Linked LearningEvents",
      ...(thread.linkedLearningEvents.length ? thread.linkedLearningEvents.slice(-12).map((eventId) => `- ${eventId}`) : ["- none"]),
      "",
      "## Approval Required",
      "This is a thread summary candidate only. It is not approved memory and must not be retrieved as durable memory unless explicitly reviewed and promoted."
    ].join("\n");
    const summaryDir = path.join(this.rootDir, "chats", "summary_candidates");
    await fs.mkdir(summaryDir, { recursive: true });
    const summaryPath = path.join(summaryDir, `${candidateId}.md`);
    await fs.writeFile(summaryPath, content, "utf8");
    this.context = [`Thread summary candidate: ${path.relative(this.rootDir, summaryPath)}`];
    this.thread = await this.threadStore.appendMessage(thread.threadId, {
      role: "system",
      content: `Thread summary candidate created at ${path.relative(this.rootDir, summaryPath)}. Approval required before memory promotion.`
    });
    return [
      "Thread summary candidate created.",
      `Path: ${path.relative(this.rootDir, summaryPath)}`,
      "Approval: required before memory promotion.",
      "Active chat context was compacted; thread history was kept."
    ].join("\n");
  }

  private async ensureThread(): Promise<ChatThread> {
    if (this.thread) return this.thread;
    this.thread = await this.threadStore.getOrCreate(this.threadId);
    this.workspace = this.thread.workspace;
    this.modeOverride = this.thread.mode === "auto" ? undefined : this.thread.mode;
    this.runIds = [...this.thread.linkedRuns];
    return this.thread;
  }

  private async findRunDir(runId: string): Promise<string> {
    const runsDir = path.join(this.rootDir, "runs");
    for (const date of (await fs.readdir(runsDir)).sort().reverse()) {
      const dateDir = path.join(runsDir, date);
      const dateStat = await fs.stat(dateDir);
      if (!dateStat.isDirectory()) continue;
      const candidate = path.join(runsDir, date, runId);
      try {
        const stat = await fs.stat(candidate);
        if (stat.isDirectory()) return candidate;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    throw new Error(`Run not found: ${runId}`);
  }

  private helpText(): string {
    return [
      "Chat commands:",
      "/help",
      "/mode auto|<mode>",
      "/project <name>",
      "/status",
      "/memory search <query>",
      "/remember <fact>",
      "/state",
      "/last",
      "/queue",
      "/metrics",
      "/learn last",
      "/prompt <task>",
      "/test-gap <feature>",
      "/policy-drift <change>",
      "/audit-last",
      "/eval",
      "/regression",
      "/replay last|<run-id>",
      "/thread",
      "/new [title]",
      "/clear",
      "/compact",
      "/show last|<run-id>",
      "/learn last|queue|metrics|inspect <event-id>|propose last",
      "/runs",
      "/quit"
    ].join("\n");
  }
}
