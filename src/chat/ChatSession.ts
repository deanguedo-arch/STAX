import fs from "node:fs/promises";
import path from "node:path";
import { createProofPacket, renderProofPacket, type EvidenceItem } from "../audit/ProofPacket.js";
import { redactProofText } from "../audit/ProofRedactor.js";
import { runEvals } from "../core/EvalRunner.js";
import { replayRun } from "../core/Replay.js";
import type { RaxRuntime } from "../core/RaxRuntime.js";
import { collectLocalEvidence, formatLocalEvidence } from "../evidence/LocalEvidenceCollector.js";
import { LearningMetricsStore } from "../learning/LearningMetrics.js";
import { LearningProposalGenerator } from "../learning/LearningProposalGenerator.js";
import { LearningQueue } from "../learning/LearningQueue.js";
import { LearningRecorder } from "../learning/LearningRecorder.js";
import { DisagreementCapture } from "../learning/DisagreementCapture.js";
import { FailureMiner } from "../lab/FailureMiner.js";
import { LabMetrics } from "../lab/LabMetrics.js";
import { LabOrchestrator } from "../lab/LabOrchestrator.js";
import { MemoryStore } from "../memory/MemoryStore.js";
import { ReviewLedger } from "../review/ReviewLedger.js";
import { ReviewQueue as ReviewQueueStore } from "../review/ReviewQueue.js";
import { ReviewRouter } from "../review/ReviewRouter.js";
import type { ReviewRecord } from "../review/ReviewSchemas.js";
import { ChatIntentClassifier } from "../operator/ChatIntentClassifier.js";
import { OperationExecutor } from "../operator/OperationExecutor.js";
import { OperationFormatter } from "../operator/OperationFormatter.js";
import type { OperationExecutionResult, OperationPlan } from "../operator/OperationSchemas.js";
import type { RaxMode } from "../schemas/Config.js";
import { RepoEvidencePackBuilder } from "../workspace/RepoEvidencePack.js";
import { RepoSearch } from "../workspace/RepoSearch.js";
import { WorkspaceContext, type ResolvedWorkspaceContext } from "../workspace/WorkspaceContext.js";
import { WorkspaceStore } from "../workspace/WorkspaceStore.js";
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
  "learning_unit",
  "model_comparison"
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

    const operatorResult = await this.handleOperator(input);
    if (operatorResult) {
      return operatorResult;
    }

    const naturalControl = await this.handleNaturalControl(input);
    if (naturalControl) {
      return naturalControl;
    }

    const output = await this.run(input, this.modeOverride ?? this.inferChatMode(input));
    return { output };
  }

  async headerText(): Promise<string> {
    const thread = await this.ensureThread();
    const workspace = await this.resolveWorkspace();
    return [
      "STAX Chat",
      `Workspace: ${workspace.workspace ?? this.workspace}`,
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

    if (command === "/workspace") {
      return { output: await this.workspaceCommand(arg) };
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

    if (command === "/lab") {
      const [labAction = "", labArg = "", labExtra = ""] = arg.split(/\s+/);
      const metrics = new LabMetrics(this.rootDir);
      if (labAction === "report") {
        return { output: JSON.stringify(await metrics.readLatest(), null, 2) };
      }
      if (labAction === "queue") {
        return { output: await metrics.queueSummary() };
      }
      if (labAction === "redteam" && labArg === "summary") {
        return { output: await metrics.redteamSummary() };
      }
      if (labAction === "failures") {
        return { output: JSON.stringify(await new FailureMiner(this.rootDir).readLatest(), null, 2) };
      }
      if (labAction === "patches") {
        return { output: await this.listLabArtifacts("patches", "patch proposals") };
      }
      if (labAction === "handoffs") {
        return { output: await this.listLabArtifacts("handoffs", "handoffs") };
      }
      if (labAction === "go") {
        if (labArg !== "cautious") {
          return { output: "Chat only allows /lab go cautious <cycles>. Use CLI for balanced/aggressive profiles." };
        }
        const cycles = Number(labExtra || "1");
        const result = await new LabOrchestrator(this.rootDir).go({
          profile: "cautious",
          cycles,
          domain: "planning",
          count: 5,
          executeVerification: false
        });
        return {
          output: [
            `Lab go cautious complete: ${result.cycles.length} cycle(s)`,
            `Summary: ${result.path}`,
            ...result.cycles.map(
              (cycle) =>
                `- ${cycle.cycleId}: scenariosRun=${cycle.scenariosRun}, failures=${cycle.failures.length}, releaseGate=${cycle.releaseGate}`
            )
          ].join("\n")
        };
      }
      return { output: "Usage: /lab report | queue | redteam summary | failures | patches | handoffs | go cautious <cycles>" };
    }

    if (command === "/review") {
      return { output: await this.reviewCommand(arg) };
    }

    if (command === "/eval" || command === "/regression") {
      const folder = command === "/regression" ? "regression" : "cases";
      const workspace = await this.resolveWorkspace();
      const result = await runEvals({
        rootDir: this.rootDir,
        folder,
        workspace: workspace.workspace,
        linkedRepoPath: workspace.linkedRepoPath
      });
      await new LearningRecorder(this.rootDir).recordCommand({
        commandName: command === "/regression" ? "chat regression" : "chat eval",
        argsSummary: command,
        success: result.failed === 0 && result.criticalFailures === 0,
        outputSummary: JSON.stringify(result),
        exitStatus: result.failed === 0 && result.criticalFailures === 0 ? 0 : 1,
        workspace: workspace.workspace
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
        const workspace = await this.resolveWorkspace();
        const result = await replayRun({ rootDir: this.rootDir, runId });
        await new LearningRecorder(this.rootDir).recordCommand({
          commandName: "chat replay",
          argsSummary: `/replay ${runId}`,
          success: result.exact,
          outputSummary: JSON.stringify(result),
          exitStatus: result.exact ? 0 : 1,
          artifactPaths: [result.replayRunId],
          workspace: workspace.workspace,
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
      const output = arg === "--proof"
        ? await this.auditLastWithProof()
        : await this.run(this.lastAssistantOutput, "codex_audit");
      return { output };
    }

    if (command === "/disagree") {
      if (!arg) return { output: "Usage: /disagree <what was wrong with the last answer>" };
      const result = await new DisagreementCapture(this.rootDir).capture({
        reason: arg,
        lastRunId: this.runIds.at(-1),
        lastOutput: this.lastAssistantOutput,
        mode: await this.lastRunMode()
      });
      return {
        output: [
          "Disagreement captured.",
          `LearningEvent: ${result.eventId}`,
          `Run: ${result.runId}`,
          `PairedEvalCandidate: ${result.pairedEvalPath}`,
          "No correction, eval, memory, training record, policy, schema, or mode was promoted."
        ].join("\n")
      };
    }

    if (command === "/compare") {
      if (!arg.startsWith("external ")) {
        return { output: "Usage: /compare external <external answer or summary>" };
      }
      if (!this.lastAssistantOutput) return { output: "No STAX answer is available to compare yet." };
      const externalAnswer = arg.replace(/^external\s+/, "").trim();
      if (!externalAnswer) return { output: "Usage: /compare external <external answer or summary>" };
      const output = await this.run(
        [
          "Compare the last STAX answer with this external assistant answer for this project.",
          "",
          "## STAX Answer",
          this.lastAssistantOutput,
          "",
          "## External Answer",
          externalAnswer,
          "",
          "## Local Proof",
          `LastRun: ${this.runIds.at(-1) ?? "none"}`
        ].join("\n"),
        "model_comparison"
      );
      return { output };
    }

    if (command === "/state") {
      const evidence = await collectLocalEvidence(this.rootDir, {
        includeProjectDocs: true,
        includeModeMaturity: true
      });
      const workspaceState = await this.workspaceStateContext();
      const output = await this.run(
        ["Project Brain local state review.", workspaceState, formatLocalEvidence(evidence)].filter(Boolean).join("\n\n"),
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

  private async handleOperator(input: string): Promise<ChatTurnResult | undefined> {
    const registry = await new WorkspaceStore(this.rootDir).list().catch(() => ({ workspaces: [] }));
    const plan = new ChatIntentClassifier().classify(input, {
      knownWorkspaces: registry.workspaces.map((workspace) => workspace.name),
      currentWorkspace: this.workspace
    });
    if (plan.intent === "unknown" && plan.executionClass === "fallback") {
      return undefined;
    }

    const result = await new OperationExecutor().execute(plan, {
      auditWorkspace: (operationPlan) => this.executeAuditWorkspaceOperation(operationPlan),
      workspaceRepoAudit: (operationPlan) => this.executeAuditWorkspaceOperation(operationPlan),
      judgmentDigest: (operationPlan) => this.executeJudgmentDigestOperation(operationPlan),
      auditLastProof: (operationPlan) => this.executeAuditLastProofOperation(operationPlan)
    });
    return { output: new OperationFormatter().format(plan, result) };
  }

  private async executeAuditWorkspaceOperation(plan: OperationPlan): Promise<OperationExecutionResult> {
    const actionsRun: string[] = ["OperationRiskGate"];
    const artifactsCreated: string[] = [];
    const evidenceChecked = ["OperationPlan"];
    try {
      const workspaceResolver = new WorkspaceContext(this.rootDir);
      const workspaceContext = plan.workspace
        ? await workspaceResolver.resolve({ workspace: plan.workspace, requireWorkspace: true })
        : await workspaceResolver.resolve({ requireWorkspace: false });
      const useActiveWorkspace = !plan.workspace && Boolean(workspaceContext.workspace && workspaceContext.linkedRepoPath);
      const workspaceResolution = plan.workspace
        ? "named_workspace"
        : useActiveWorkspace
          ? "active_workspace"
          : "current_repo";
      const targetRepoPath = plan.workspace || useActiveWorkspace
        ? workspaceContext.linkedRepoPath
        : this.rootDir;
      const workspaceLabel = plan.workspace || useActiveWorkspace
        ? workspaceContext.workspace ?? plan.workspace ?? "unknown_workspace"
        : "current_repo";
      const workspaceDocs = workspaceContext.workspace && (plan.workspace || useActiveWorkspace)
        ? await new WorkspaceStore(this.rootDir).readWorkspaceDocs(workspaceContext.workspace)
        : [];
      const repoEvidencePack = targetRepoPath
        ? await new RepoEvidencePackBuilder().build({
            repoPath: targetRepoPath,
            workspace: workspaceLabel === "current_repo" ? undefined : workspaceLabel,
            workspaceResolution
          })
        : undefined;
      const localEvidence = await collectLocalEvidence(this.rootDir, {
        includeProjectDocs: true,
        includeModeMaturity: true
      });

      actionsRun.push(plan.workspace ? "WorkspaceContext.resolve named" : useActiveWorkspace ? "WorkspaceContext.resolve active" : "current repo root");
      actionsRun.push("collectLocalEvidence", ...(repoEvidencePack ? ["RepoEvidencePack.build"] : []), "RaxRuntime.run codex_audit");
      evidenceChecked.push(
        `Workspace: ${workspaceLabel}`,
        `WorkspaceResolution: ${workspaceResolution}`,
        `WorkspaceSource: ${workspaceContext.source}`,
        ...(targetRepoPath ? [`RepoPath: ${targetRepoPath}`] : ["RepoPath: none"]),
        "LocalEvidenceCollector",
        ...workspaceDocs.filter((doc) => doc.exists).map((doc) => doc.path),
        ...(repoEvidencePack?.inspectedFiles.map((file) => `repo:${file}`) ?? []),
        ...(repoEvidencePack?.testFiles.map((file) => `repo-test:${file}`) ?? []),
        ...(repoEvidencePack?.scripts.map((script) => `repo-script:${script.name}`) ?? [])
      );

      const auditInput = [
        plan.intent === "workspace_repo_audit"
          ? "Audit this linked workspace repo using only the read-only repo evidence below."
          : "Audit this STAX workspace or repo using only the local proof below.",
        "",
        "## Operator Plan",
        `- Operation: ${plan.intent}`,
        `- Original Input: ${plan.originalInput}`,
        `- Objective: ${plan.objective}`,
        `- Workspace: ${workspaceLabel}`,
        `- WorkspaceResolution: ${workspaceResolution}`,
        `- RepoPath: ${targetRepoPath ?? "none"}`,
        "",
        repoEvidencePack?.markdown ?? "## Repo Evidence Pack\n- No linked repo path configured for this workspace.",
        "",
        workspaceDocs.length
          ? [
              "## Workspace Docs",
              ...workspaceDocs.map((doc) => [
                `### ${doc.path}`,
                doc.exists ? ["```txt", doc.excerpt ?? "", "```"].join("\n") : "- Missing"
              ].join("\n"))
            ].join("\n")
          : "## Workspace Docs\n- No workspace docs were available.",
        "",
        formatLocalEvidence(localEvidence),
        "",
        "## Audit Request",
        "Return a proof-aware audit. State what is verified, what is not verified, risks, missing evidence, and the next allowed action. Do not claim approval or promotion."
      ].join("\n");
      const auditOutput = await this.run(auditInput, "codex_audit");
      const runId = auditOutput.match(/\bRun: (run-[^\s]+)/)?.[1];
      if (runId) artifactsCreated.push(`runs/${runId}`);
      const resultOutput = [
        repoEvidencePack?.markdown,
        "",
        "## Governed Audit",
        auditOutput
      ].filter(Boolean).join("\n");
      return {
        executed: true,
        blocked: false,
        deferred: false,
        actionsRun,
        artifactsCreated,
        evidenceChecked,
        result: resultOutput,
        risks: [
          ...(workspaceResolution === "current_repo" && workspaceContext.workspace && !workspaceContext.linkedRepoPath
            ? [`Active workspace ${workspaceContext.workspace} has no linked repo path; audited the current STAX repo root.`]
            : []),
          ...(workspaceResolution === "current_repo" && !workspaceContext.workspace
            ? ["No active linked workspace was selected; audited the current STAX repo root."]
            : []),
          ...(targetRepoPath ? [] : ["Workspace has no linked repo path, so repo evidence is missing."])
        ],
        nextAllowedActions: ["Use the Codex Prompt or Required Next Proof from the audit. Promotions still require explicit CLI approval commands."]
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        executed: false,
        blocked: false,
        deferred: true,
        actionsRun,
        artifactsCreated,
        evidenceChecked,
        result: [
          "Workspace audit was not run.",
          message,
          "",
          "STAX did not fall back to another repo because that could audit the wrong project."
        ].join("\n"),
        risks: ["Missing or ambiguous workspace."],
        nextAllowedActions: [
          plan.workspace
            ? `Create or link it first: rax workspace create ${plan.workspace} --repo <path> --use`
            : "Set a workspace with rax workspace use <name>, or say \"audit this repo\"."
        ]
      };
    }
  }

  private async executeJudgmentDigestOperation(_plan: OperationPlan): Promise<OperationExecutionResult> {
    const queue = new ReviewQueueStore(this.rootDir);
    const records = await queue.list();
    const dispositionCounts = this.countReviewRecords(records, "disposition");
    const formatted = queue.formatInbox(records, "Judgment Digest");
    return {
      executed: true,
      blocked: false,
      deferred: false,
      actionsRun: ["ReviewQueue.list"],
      artifactsCreated: [],
      evidenceChecked: ["review/queue"],
      result: [
        formatted,
        "",
        "Visible Judgment Counts:",
        `- total: ${records.length}`,
        `- human_review: ${dispositionCounts.human_review ?? 0}`,
        `- hard_block: ${dispositionCounts.hard_block ?? 0}`,
        `- batch_review: ${dispositionCounts.batch_review ?? 0}`,
        "",
        "This read the current persisted review queue only. It did not refresh, apply, approve, reject, archive, or promote anything."
      ].join("\n"),
      risks: records.length ? [] : ["No persisted judgment items were found. A dry-run refresh may reveal new candidate review items."],
      nextAllowedActions: ["Use /review digest for a dry-run discovery, or CLI `rax review inbox` to refresh persisted review metadata."]
    };
  }

  private async executeAuditLastProofOperation(_plan: OperationPlan): Promise<OperationExecutionResult> {
    if (!this.runIds.at(-1)) {
      return {
        executed: false,
        blocked: false,
        deferred: true,
        actionsRun: [],
        artifactsCreated: [],
        evidenceChecked: ["current thread run list"],
        result: "No chat run is available to audit with proof yet.",
        risks: ["Missing last run."],
        nextAllowedActions: ["Ask STAX something normally first, then ask what the last run proved."]
      };
    }
    const output = await this.auditLastWithProof();
    const runId = output.match(/\bRun: (run-[^\s]+)/)?.[1];
    return {
      executed: true,
      blocked: false,
      deferred: false,
      actionsRun: ["auditLastWithProof", "RaxRuntime.run codex_audit"],
      artifactsCreated: runId ? [`runs/${runId}`] : [],
      evidenceChecked: ["last chat-linked run", "trace.json", "learning_event.json if linked", "local evidence"],
      result: output,
      risks: [],
      nextAllowedActions: ["Use the Required Next Proof from the audit before claiming completion."]
    };
  }

  private async handleNaturalControl(input: string): Promise<ChatTurnResult | undefined> {
    const normalized = input
      .toLowerCase()
      .replace(/[^\w\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (this.isSandboxGoIntent(normalized)) {
      const result = await new LabOrchestrator(this.rootDir).go({
        profile: "cautious",
        cycles: 1,
        domain: "planning",
        count: 5,
        executeVerification: false
      });
      return {
        output: [
          "I ran the safe sandbox cycle.",
          "",
          `Profile: cautious`,
          `Cycles: ${result.cycles.length}`,
          `Summary: ${result.path}`,
          ...result.cycles.map(
            (cycle) =>
              `- ${cycle.cycleId}: scenariosRun=${cycle.scenariosRun}, failures=${cycle.failures.length}, releaseGate=${cycle.releaseGate}`
          ),
          "",
          "Nothing was approved, promoted, merged, trained, or written into durable memory.",
          "Say \"show sandbox report\", \"show sandbox failures\", or \"show sandbox patches\" to inspect what happened."
        ].join("\n")
      };
    }

    if (this.isLabReportIntent(normalized)) {
      const report = await new LabMetrics(this.rootDir).readLatest();
      return { output: JSON.stringify(report, null, 2) };
    }

    if (this.isLabFailureIntent(normalized)) {
      return { output: JSON.stringify(await new FailureMiner(this.rootDir).readLatest(), null, 2) };
    }

    if (this.isLabPatchIntent(normalized)) {
      return { output: await this.listLabArtifacts("patches", "patch proposals") };
    }

    if (this.isLastRunExplanationIntent(normalized)) {
      return { output: await this.explainLastRun() };
    }

    if (this.isStatusIntent(normalized)) {
      return { output: await this.statusSummary() };
    }

    if (this.isQueueIntent(normalized)) {
      return { output: await this.queueSummary() };
    }

    if (this.isMetricsIntent(normalized)) {
      return { output: await this.metricsSummary() };
    }

    if (this.isLearnLastIntent(normalized)) {
      const runId = this.runIds.at(-1);
      if (!runId) return { output: "No chat run is available to analyze yet." };
      const output = await this.run(`Analyze run ${runId} and propose how STAX should improve from it.`, "learning_unit");
      return { output };
    }

    if (this.isAuditLastIntent(normalized)) {
      if (!this.lastAssistantOutput) return { output: "No assistant output to audit yet." };
      const output = /\b(proof|evidence|verified)\b/.test(normalized)
        ? await this.auditLastWithProof()
        : await this.run(this.lastAssistantOutput, "codex_audit");
      return { output };
    }

    if (this.isDisagreeIntent(normalized)) {
      const result = await new DisagreementCapture(this.rootDir).capture({
        reason: input,
        lastRunId: this.runIds.at(-1),
        lastOutput: this.lastAssistantOutput,
        mode: await this.lastRunMode()
      });
      return {
        output: [
          "Disagreement captured.",
          `LearningEvent: ${result.eventId}`,
          `Run: ${result.runId}`,
          `PairedEvalCandidate: ${result.pairedEvalPath}`,
          "No durable artifact was promoted automatically."
        ].join("\n")
      };
    }

    if (this.isEvalIntent(normalized)) {
      return { output: await this.runChatEval("cases", "Eval") };
    }

    if (this.isRegressionIntent(normalized)) {
      return { output: await this.runChatEval("regression", "Regression") };
    }

    if (this.isReplayLastIntent(normalized)) {
      return { output: await this.replayLastRun() };
    }

    if (this.isHowToUseIntent(normalized)) {
      return { output: this.plainEnglishHelpText() };
    }

    if (this.isModeAutoIntent(normalized)) {
      this.modeOverride = undefined;
      this.thread = await this.threadStore.updateMode(this.threadId, "auto");
      return { output: "Mode reset to auto. Normal chat will pick the mode from your message now." };
    }

    return undefined;
  }

  private isSandboxGoIntent(input: string): boolean {
    const mentionsSandbox = /\b(sandbox|sand box|lab|learning lab)\b/.test(input);
    const asksToRun = /\b(unleash|unlesh|launch|start|run|go|let loose|let it loose|kick off|stress test)\b/.test(input);
    const mentionsWorkers = /\b(agent|agents|worker|workers|team)\b/.test(input);
    return mentionsSandbox && (asksToRun || mentionsWorkers);
  }

  private isLabReportIntent(input: string): boolean {
    return /\b(show|open|view|what is|what's|give me)\b/.test(input) && /\b(sandbox|lab)\b/.test(input) && /\breport\b/.test(input);
  }

  private isLabFailureIntent(input: string): boolean {
    return /\b(show|open|view|what|list|give me)\b/.test(input) && /\b(sandbox|lab)\b/.test(input) && /\b(failure|failures|failed|weakness|weaknesses)\b/.test(input);
  }

  private isLabPatchIntent(input: string): boolean {
    return /\b(show|open|view|what|list|give me)\b/.test(input) && /\b(sandbox|lab)\b/.test(input) && /\b(patch|patches|proposal|proposals|handoff|handoffs)\b/.test(input);
  }

  private isLastRunExplanationIntent(input: string): boolean {
    return /\b(what did you just do|what just happened|what happened there|explain that|explain the last run|what did that do)\b/.test(input);
  }

  private isModeAutoIntent(input: string): boolean {
    return /\b(reset|switch|set)\b/.test(input) && /\bmode\b/.test(input) && /\bauto\b/.test(input);
  }

  private isStatusIntent(input: string): boolean {
    return /^(show )?(status|system status|chat status)$/.test(input) || /\bwhat'?s the status\b/.test(input);
  }

  private isQueueIntent(input: string): boolean {
    return /\b(show|check|what'?s in|list)\b/.test(input) && /\b(queue|learning queue)\b/.test(input);
  }

  private isMetricsIntent(input: string): boolean {
    return /\b(show|check|what are|what'?s|list)\b/.test(input) && /\b(metrics|learning metrics|numbers)\b/.test(input);
  }

  private isLearnLastIntent(input: string): boolean {
    return /\b(learn from that|learn from this|analyze last run|analyse last run|what should stax learn|make a learning event|propose improvements)\b/.test(input);
  }

  private isAuditLastIntent(input: string): boolean {
    return /\b(audit last|audit that|audit this|check last answer|check that answer|review last answer)\b/.test(input);
  }

  private isEvalIntent(input: string): boolean {
    return /\b(run|start|do)\b/.test(input) && /\b(eval|evals|evaluation|evaluations)\b/.test(input) && !/\bregression\b/.test(input);
  }

  private isRegressionIntent(input: string): boolean {
    return /\b(run|start|do)\b/.test(input) && /\b(regression|regressions)\b/.test(input);
  }

  private isReplayLastIntent(input: string): boolean {
    return /\b(replay|rerun)\b/.test(input) && /\b(last|previous)\b/.test(input);
  }

  private isHowToUseIntent(input: string): boolean {
    return /\b(how do i use|what can you do|help me use|make this easy|easy on all fronts)\b/.test(input);
  }

  private isDisagreeIntent(input: string): boolean {
    return /\b(i disagree|that is wrong|you missed|should have allowed|should have refused|over refused|under refused|over-refused|under-refused)\b/.test(input);
  }

  private async workspaceCommand(arg: string): Promise<string> {
    await this.ensureThread();
    const [action = "status", ...rest] = arg.split(/\s+/).filter(Boolean);
    const store = new WorkspaceStore(this.rootDir);
    if (action === "status" || action === "current") {
      const context = await this.resolveWorkspace();
      return [
        "Workspace Status",
        `Workspace: ${context.workspace ?? "none"}`,
        `Source: ${context.source}`,
        `RepoPath: ${context.repoPath ?? "none"}`,
        `LinkedRepoPath: ${context.linkedRepoPath ?? "none"}`
      ].join("\n");
    }
    if (action === "use") {
      const name = rest[0];
      if (!name) return "Usage: /workspace use <name>";
      const record = await store.use(name);
      this.workspace = record.workspace;
      this.thread = await this.threadStore.updateWorkspace(this.threadId, record.workspace);
      return `workspace: ${record.workspace}`;
    }
    if (action === "list") {
      return JSON.stringify(await store.list(), null, 2);
    }
    if (action === "show") {
      const name = rest[0] || this.workspace;
      const record = await store.get(name);
      return record ? JSON.stringify(record, null, 2) : `Workspace not found: ${name}`;
    }
    if (action === "repo-summary") {
      const context = await this.resolveWorkspace(true);
      if (!context.linkedRepoPath) return `Workspace has no linked repo path: ${context.workspace ?? "none"}`;
      return (await new RepoEvidencePackBuilder().build({
        repoPath: context.linkedRepoPath,
        workspace: context.workspace,
        workspaceResolution: "active_workspace"
      })).markdown;
    }
    if (action === "search") {
      const query = rest.join(" ");
      if (!query.trim()) return "Usage: /workspace search <query>";
      const context = await this.resolveWorkspace(true);
      if (!context.linkedRepoPath) return `Workspace has no linked repo path: ${context.workspace ?? "none"}`;
      const search = new RepoSearch(context.linkedRepoPath);
      return search.format(await search.search(query), query);
    }
    return "Usage: /workspace status|use <name>|list|show <name>|repo-summary|search <query>";
  }

  private async run(input: string, mode?: RaxMode): Promise<string> {
    await this.ensureThread();
    const workspace = await this.resolveWorkspace();
    const result = await this.runtime.run(input, [`Workspace: ${workspace.workspace ?? this.workspace}`, ...this.context], {
      mode,
      workspace: workspace.workspace,
      linkedRepoPath: workspace.linkedRepoPath
    });
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
    if (/\b(model comparison|compare external|external answer|chatgpt answer|compare answers)\b/i.test(input)) {
      return "model_comparison";
    }
    return undefined;
  }

  private async lastRunMode(): Promise<RaxMode | undefined> {
    const runId = this.runIds.at(-1);
    if (!runId) return undefined;
    try {
      const runDir = await this.findRunDir(runId);
      const trace = JSON.parse(await fs.readFile(path.join(runDir, "trace.json"), "utf8")) as { mode?: RaxMode };
      return trace.mode;
    } catch {
      return undefined;
    }
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

  private async explainLastRun(): Promise<string> {
    const runId = this.runIds.at(-1);
    if (!runId) {
      return "No chat run is available yet. Say something normally first, then ask what happened or what the last run proved.";
    }
    const runDir = await this.findRunDir(runId);
    const trace = JSON.parse(await fs.readFile(path.join(runDir, "trace.json"), "utf8")) as {
      mode?: string;
      learningEventId?: string;
      learningQueues?: string[];
      validation?: { valid?: boolean };
    };
    return [
      "That message went through the governed STAX runtime.",
      "",
      `Run: ${runId}`,
      `Mode: ${trace.mode ?? "unknown"}`,
      `Validation: ${trace.validation?.valid === false ? "failed" : "passed"}`,
      `LearningEvent: ${trace.learningEventId ?? "none"}`,
      `Queues: ${trace.learningQueues?.join(", ") || "none"}`,
      `Trace: ${path.relative(this.rootDir, path.join(runDir, "trace.json"))}`,
      "",
      "In plain English: STAX answered, saved a trace, recorded a LearningEvent, and did not promote anything automatically."
    ].join("\n");
  }

  private async listLabArtifacts(folder: "patches" | "handoffs", label: string): Promise<string> {
    const dir = path.join(this.rootDir, "learning", "lab", folder);
    try {
      const entries = (await fs.readdir(dir)).filter((entry) => entry.endsWith(".json") || entry.endsWith(".md")).sort();
      if (entries.length === 0) return `- No lab ${label}.`;
      return [`Lab ${label}: ${entries.length}`, ...entries.slice(-20).map((entry) => `- ${path.join("learning", "lab", folder, entry)}`)].join("\n");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return `- No lab ${label}.`;
      throw error;
    }
  }

  private async reviewCommand(arg: string): Promise<string> {
    const [action = "inbox", ...rest] = arg.split(/\s+/).filter(Boolean);
    const router = new ReviewRouter(this.rootDir);
    const queue = new ReviewQueueStore(this.rootDir);
    if (action === "route") {
      const sourceId = rest.join(" ");
      if (!sourceId) return "Usage: /review route <source-id-or-path>";
      const result = await router.routeSourceId(sourceId, { apply: false });
      return [
        "Review route dry-run.",
        JSON.stringify(result.record, null, 2),
        "",
        "No review metadata was written. No approval or promotion happened."
      ].join("\n");
    }
    if (action === "show") {
      const reviewId = rest[0];
      if (!reviewId) return "Usage: /review show <review-id>";
      const record = await new ReviewLedger(this.rootDir).get(reviewId);
      return record ? JSON.stringify(record, null, 2) : `Review item not found: ${reviewId}`;
    }
    if (action === "stats" || action === "metrics") {
      const records = await router.refresh({ apply: false });
      return [
        "Review metrics dry-run.",
        `Total sources: ${records.length}`,
        "By disposition:",
        ...Object.entries(this.countReviewRecords(records, "disposition")).map(([key, count]) => `- ${key}: ${count}`),
        "By risk:",
        ...Object.entries(this.countReviewRecords(records, "riskLevel")).map(([key, count]) => `- ${key}: ${count}`),
        "",
        "No review metadata was written."
      ].join("\n");
    }
    if (["inbox", "digest", "batch", "blocked", "staged", "all"].includes(action)) {
      const records = this.filterReviewRecords(await router.refresh({ apply: false }), action);
      const title = action === "blocked"
        ? "Blocked Review Items (dry-run)"
        : action === "staged"
          ? "Auto-Staged Review Items (dry-run)"
          : action === "all"
            ? "All Review Items (dry-run)"
            : "Review Inbox (dry-run)";
      return [
        queue.formatInbox(records, title),
        "",
        "Chat review is read-only in this slice. Use CLI `rax review inbox` to refresh persisted review metadata."
      ].join("\n");
    }
    return "Usage: /review [inbox|digest|blocked|staged|all|stats|route <source>|show <review-id>]";
  }

  private filterReviewRecords(records: ReviewRecord[], action: string): ReviewRecord[] {
    const active = records.filter((record) => record.state === "active");
    if (action === "all") return active;
    if (action === "staged") return active.filter((record) => record.disposition === "auto_stage_for_review");
    if (action === "blocked") return active.filter((record) => record.disposition === "hard_block");
    return active.filter((record) => ["batch_review", "human_review", "hard_block"].includes(record.disposition));
  }

  private countReviewRecords(records: ReviewRecord[], key: "disposition" | "riskLevel"): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const record of records) {
      counts[record[key]] = (counts[record[key]] ?? 0) + 1;
    }
    return counts;
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
    const workspace = await this.resolveWorkspace();
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
      `Workspace: ${workspace.workspace ?? this.workspace}`,
      `WorkspaceSource: ${workspace.source}`,
      `LinkedRepoPath: ${workspace.linkedRepoPath ?? "none"}`,
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

  private async resolveWorkspace(requireWorkspace = false): Promise<ResolvedWorkspaceContext> {
    const thread = await this.ensureThread();
    const resolved = await new WorkspaceContext(this.rootDir).resolve({
      threadWorkspace: thread.workspace,
      requireWorkspace
    });
    if (resolved.workspace && resolved.workspace !== this.workspace) {
      this.workspace = resolved.workspace;
      this.thread = await this.threadStore.updateWorkspace(this.threadId, resolved.workspace);
    }
    return resolved;
  }

  private async workspaceStateContext(): Promise<string> {
    const context = await this.resolveWorkspace();
    if (!context.workspace) {
      return "## Workspace Context\n- No active workspace.\n- Falling back to global project docs only.";
    }
    const docs = await new WorkspaceStore(this.rootDir).readWorkspaceDocs(context.workspace);
    const repoSummary = context.linkedRepoPath
      ? (await new RepoEvidencePackBuilder().build({
          repoPath: context.linkedRepoPath,
          workspace: context.workspace,
          workspaceResolution: "active_workspace"
        })).markdown
      : "## Repo Evidence Pack\n- No linked repo path configured.";
    return [
      "## Workspace Context",
      `- Workspace: ${context.workspace}`,
      `- RepoPath: ${context.repoPath ?? "none"}`,
      `- LinkedRepoPath: ${context.linkedRepoPath ?? "none"}`,
      "",
      repoSummary,
      "",
      "## Workspace Docs",
      ...docs.map((doc) => [
        `### ${doc.path}`,
        doc.exists ? ["```txt", doc.excerpt ?? "", "```"].join("\n") : "- Missing"
      ].join("\n"))
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

  private async runChatEval(folder: "cases" | "regression", label: string): Promise<string> {
    const result = await runEvals({ rootDir: this.rootDir, folder });
    await new LearningRecorder(this.rootDir).recordCommand({
      commandName: `chat ${label.toLowerCase()}`,
      argsSummary: label.toLowerCase(),
      success: result.failed === 0 && result.criticalFailures === 0,
      outputSummary: JSON.stringify(result),
      exitStatus: result.failed === 0 && result.criticalFailures === 0 ? 0 : 1
    });
    return [
      `${label}: ${result.passed}/${result.total}`,
      `passRate: ${result.passRate}`,
      `criticalFailures: ${result.criticalFailures}`
    ].join("\n");
  }

  private async replayLastRun(): Promise<string> {
    const runId = this.runIds.at(-1);
    if (!runId) return "No chat run is available to replay.";
    try {
      const result = await replayRun({ rootDir: this.rootDir, runId });
      await new LearningRecorder(this.rootDir).recordCommand({
        commandName: "chat replay",
        argsSummary: `replay ${runId}`,
        success: result.exact,
        outputSummary: JSON.stringify(result),
        exitStatus: result.exact ? 0 : 1,
        artifactPaths: [result.replayRunId],
        runId
      });
      return [
        `Replay: ${result.exact ? "exact" : "drift detected"}`,
        `OriginalRun: ${result.originalRunId}`,
        `ReplayRun: ${result.replayRunId}`,
        `OutputExact: ${result.outputExact}`,
        `TraceExact: ${result.traceExact}`,
        `Reason: ${result.reason ?? "none"}`
      ].join("\n");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await new LearningRecorder(this.rootDir).recordCommand({
        commandName: "chat replay",
        argsSummary: `replay ${runId}`,
        success: false,
        outputSummary: message,
        exitStatus: 1,
        runId
      });
      return `Replay failed: ${message}`;
    }
  }

  private async auditLastWithProof(): Promise<string> {
    const runId = this.runIds.at(-1);
    if (!runId) return "No chat run is available to audit with proof.";
    const thread = await this.ensureThread();
    const runDir = await this.findRunDir(runId);
    const runStat = await fs.stat(runDir);
    const tracePath = path.join(runDir, "trace.json");
    const trace = JSON.parse(await fs.readFile(tracePath, "utf8")) as {
      mode?: string;
      boundaryMode?: string;
      selectedAgent?: string;
      validation?: { valid?: boolean; issues?: string[] };
      learningEventId?: string;
      learningQueues?: string[];
      policiesApplied?: string[];
    };
    const evidence = await collectLocalEvidence(this.rootDir, { includeModeMaturity: true });
    const runRelativePath = path.relative(this.rootDir, runDir);
    const traceRelativePath = path.relative(this.rootDir, tracePath);
    const rawProofText = [
      "## Previous Assistant Output",
      this.lastAssistantOutput,
      "",
      formatLocalEvidence(evidence)
    ].join("\n");
    const redacted = redactProofText(rawProofText);
    const [previousAssistantSection, localEvidenceSection] = redacted.text.split(/\n## Local Evidence\n/);
    const evidenceItems: EvidenceItem[] = [
      {
        evidenceId: "ev_last_run",
        evidenceType: "run",
        path: runRelativePath,
        summary: "Last chat-linked run folder selected from the current thread.",
        claimSupported: "The audit is scoped to the current thread's last assistant run.",
        confidence: "high"
      },
      {
        evidenceId: "ev_last_trace",
        evidenceType: "trace",
        path: traceRelativePath,
        summary: `Trace reports mode=${trace.mode ?? "unknown"} validation=${trace.validation?.valid === false ? "failed" : "passed"}.`,
        claimSupported: "The previous answer has runtime trace evidence.",
        confidence: "high"
      }
    ];
    if (trace.learningEventId) {
      evidenceItems.push({
        evidenceId: "ev_last_learning_event",
        evidenceType: "learning_event",
        path: path.join("learning", "events", "hot", `${trace.learningEventId}.json`),
        summary: `LearningEvent linked by trace: ${trace.learningEventId}.`,
        claimSupported: "The previous answer has a linked LearningEvent.",
        confidence: "high"
      });
    }
    if (evidence.latestEval) {
      evidenceItems.push({
        evidenceId: "ev_latest_eval",
        evidenceType: "eval",
        path: evidence.latestEval.path,
        command: "npm run rax -- eval or regression eval artifact",
        summary: `Latest eval artifact: passed=${evidence.latestEval.passed ?? "unknown"} failed=${evidence.latestEval.failed ?? "unknown"} passRate=${evidence.latestEval.passRate ?? "unknown"}.`,
        claimSupported: "Latest eval evidence is available for audit context.",
        confidence: evidence.latestEval.failed === 0 && evidence.latestEval.criticalFailures === 0 ? "high" : "medium"
      });
    }

    const ambiguityWarnings = [
      ...(evidence.latestRunFolder && evidence.latestRunFolder !== runRelativePath
        ? [`Global latest run ${evidence.latestRunFolder} differs from current thread last run ${runRelativePath}.`]
        : []),
      ...(thread.linkedRuns.at(-1) && thread.linkedRuns.at(-1) !== runId
        ? [`Thread latest linked run ${thread.linkedRuns.at(-1)} differs from selected run ${runId}.`]
        : [])
    ];
    const proofPacket = createProofPacket({
      workspace: this.workspace,
      threadId: thread.threadId,
      runId,
      runCreatedAt: runStat.birthtime.toISOString(),
      mode: trace.mode,
      boundaryMode: trace.boundaryMode,
      selectedAgent: trace.selectedAgent,
      validationStatus: trace.validation?.valid === false ? "failed" : "passed",
      learningEventId: trace.learningEventId,
      learningQueues: trace.learningQueues ?? [],
      policiesApplied: trace.policiesApplied ?? [],
      evidenceItems,
      redactions: redacted.redactions,
      ambiguityWarnings
    });
    const auditInput = [
      "Audit the previous STAX assistant output using local proof.",
      "",
      renderProofPacket(proofPacket),
      "",
      previousAssistantSection,
      "",
      localEvidenceSection ? `## Local Evidence\n${localEvidenceSection}` : "## Local Evidence\n- None."
    ].join("\n");
    return this.run(auditInput, "codex_audit");
  }

  private plainEnglishHelpText(): string {
    return [
      "You can talk normally. I understand these plain-English controls:",
      "",
      "- \"audit canvas-helper\"",
      "- \"audit this repo\"",
      "- \"what needs my judgment?\"",
      "- \"what did the last run prove?\"",
      "- \"what just happened?\"",
      "- \"show status\"",
      "- \"show queue\"",
      "- \"show metrics\"",
      "- \"learn from that\"",
      "- \"audit last answer\"",
      "- \"I disagree because ...\"",
      "- \"/compare external <answer>\"",
      "- \"replay last run\"",
      "- \"show sandbox report\"",
      "- \"show sandbox failures\"",
      "- \"show sandbox patches\"",
      "- \"/review\"",
      "- \"reset mode to auto\"",
      "",
      "Guardrails stay on: plain chat can inspect proof and judgment items. Lab runs, evals, regression, comparison, and approvals remain explicit slash or CLI actions."
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
    this.lastAssistantOutput = [...this.thread.messages].reverse().find((message) => message.role === "assistant")?.content ?? "";
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
      "/workspace status|use <name>|list|show <name>|repo-summary|search <query>",
      "/status",
      "/memory search <query>",
      "/remember <fact>",
      "/state",
      "/last",
      "/queue",
      "/metrics",
      "/learn last",
      "/lab report|queue|redteam summary|failures|patches|handoffs|go cautious <cycles>",
      "/review [inbox|digest|blocked|staged|all|stats|route <source>|show <review-id>]",
      "/prompt <task>",
      "/test-gap <feature>",
      "/policy-drift <change>",
      "/audit-last",
      "/audit-last --proof",
      "/disagree <reason>",
      "/compare external <answer>",
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
