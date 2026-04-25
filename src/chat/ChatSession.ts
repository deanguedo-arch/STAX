import fs from "node:fs/promises";
import path from "node:path";
import type { RaxRuntime } from "../core/RaxRuntime.js";
import { collectLocalEvidence, formatLocalEvidence } from "../evidence/LocalEvidenceCollector.js";
import { LearningMetricsStore } from "../learning/LearningMetrics.js";
import { LearningProposalGenerator } from "../learning/LearningProposalGenerator.js";
import { LearningQueue } from "../learning/LearningQueue.js";
import { MemoryStore } from "../memory/MemoryStore.js";
import type { RaxMode } from "../schemas/Config.js";

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
  private workspace = "STAX";
  private runIds: string[] = [];
  private lastAssistantOutput = "";

  constructor(
    private runtime: RaxRuntime,
    private memoryStore = new MemoryStore(),
    private rootDir = process.cwd()
  ) {}

  async handleLine(line: string): Promise<ChatTurnResult> {
    const input = line.trim();
    if (!input) return { output: "" };
    if (input.startsWith("/")) {
      return this.handleCommand(input);
    }

    const output = await this.run(input, this.modeOverride ?? this.inferChatMode(input));
    return { output };
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
        return { output: "mode: auto" };
      }
      if (!VALID_MODES.includes(arg as RaxMode)) {
        return { output: `Unknown mode: ${arg}\nValid modes: ${VALID_MODES.join(", ")}` };
      }
      this.modeOverride = arg as RaxMode;
      return { output: `mode: ${this.modeOverride}` };
    }

    if (command === "/project") {
      if (!arg) return { output: `project: ${this.workspace}` };
      this.workspace = arg;
      this.context.push(`Workspace: ${this.workspace}`);
      return { output: `project: ${this.workspace}` };
    }

    if (command === "/runs") {
      return {
        output: this.runIds.length ? this.runIds.map((runId) => `- ${runId}`).join("\n") : "- No chat runs yet."
      };
    }

    if (command === "/show") {
      const runId = arg && arg !== "last" ? arg : this.runIds.at(-1);
      if (!runId) return { output: "No chat run is available to show." };
      return { output: await this.showRun(runId) };
    }

    if (command === "/learn") {
      const [learnAction = "", learnArg = ""] = arg.split(/\s+/);
      if (learnAction === "queue") {
        const items = await new LearningQueue(this.rootDir).list();
        return {
          output: items.length
            ? items.map((item) => `- ${item.queueItemId} [${item.queueType}] ${item.reason}`).join("\n")
            : "- No learning queue items."
        };
      }
      if (learnAction === "metrics") {
        return { output: JSON.stringify(await new LearningMetricsStore(this.rootDir).read(), null, 2) };
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
      return { output: "Usage: /learn queue | metrics | inspect <event-id> | propose last" };
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
    const result = await this.runtime.run(input, [`Workspace: ${this.workspace}`, ...this.context], { mode });
    this.runIds.push(result.runId);
    this.lastAssistantOutput = result.output;
    this.context.push(`User: ${input}`);
    this.context.push(`RAX: ${result.output}`);
    this.context = this.context.slice(-12);
    return [result.output, "", `Run: ${result.runId}`].join("\n");
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

  private async findRunDir(runId: string): Promise<string> {
    const runsDir = path.join(this.rootDir, "runs");
    for (const date of (await fs.readdir(runsDir)).sort().reverse()) {
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
      "/memory search <query>",
      "/remember <fact>",
      "/state",
      "/prompt <task>",
      "/test-gap <feature>",
      "/policy-drift <change>",
      "/audit-last",
      "/show last|<run-id>",
      "/learn queue|metrics|inspect <event-id>|propose last",
      "/runs",
      "/quit"
    ].join("\n");
  }
}
