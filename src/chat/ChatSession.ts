import type { RaxRuntime } from "../core/RaxRuntime.js";
import { collectLocalEvidence, formatLocalEvidence } from "../evidence/LocalEvidenceCollector.js";
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
  "policy_drift"
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
    return undefined;
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
      "/runs",
      "/quit"
    ].join("\n");
  }
}
