import fs from "node:fs/promises";
import path from "node:path";
import {
  CodexHandoffSchema,
  PatchProposalSchema,
  ensureLabDirs,
  labId,
  relativeLabPath,
  resolveLabPath,
  type CodexHandoff,
  type PatchProposal
} from "./LearningWorker.js";

export class CodexHandoffWorker {
  constructor(private rootDir = process.cwd()) {}

  async create(input: { patch: PatchProposal | string }): Promise<{ path: string; handoff: CodexHandoff }> {
    await ensureLabDirs(this.rootDir);
    const patch =
      typeof input.patch === "string"
        ? PatchProposalSchema.parse(JSON.parse(await fs.readFile(resolveLabPath(this.rootDir, input.patch), "utf8")))
        : PatchProposalSchema.parse(input.patch);
    const handoff = CodexHandoffSchema.parse({
      handoffId: labId("handoff"),
      patchId: patch.patchId,
      branchSuggested: `codex/lab-${patch.patchId.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 48)}`,
      prompt: this.prompt(patch),
      requiredCommands: patch.commandsToRun,
      stopConditions: [
        "Stop if tests or evals fail.",
        "Stop if the patch requires weakening a safety gate.",
        "Stop before approval, promotion, merge, or git push unless the user explicitly asks."
      ],
      finalReportRequired: [
        "files changed",
        "tests added",
        "commands run with results",
        "before/after proof",
        "remaining risks"
      ]
    });
    const file = path.join(this.rootDir, "learning", "lab", "handoffs", `${handoff.handoffId}.md`);
    await fs.writeFile(file, this.markdown(handoff), "utf8");
    return { path: relativeLabPath(this.rootDir, file), handoff };
  }

  private prompt(patch: PatchProposal): string {
    return [
      "# STAX Lab Handoff",
      "",
      "Implement this bounded patch proposal. Do not broaden scope.",
      "",
      `Patch ID: ${patch.patchId}`,
      `Source cluster: ${patch.sourceClusterId}`,
      `Risk: ${patch.risk}`,
      "",
      "Files to inspect:",
      ...patch.filesToInspect.map((file) => `- ${file}`),
      "",
      "Files likely to modify:",
      ...patch.filesToModify.map((file) => `- ${file}`),
      "",
      "Tests to add:",
      ...patch.testsToAdd.map((test) => `- ${test}`),
      "",
      "Commands to run:",
      ...patch.commandsToRun.map((command) => `- ${command}`),
      "",
      "Acceptance criteria:",
      ...patch.acceptanceCriteria.map((criterion) => `- ${criterion}`),
      "",
      "Boundaries:",
      "- Do not approve, promote, or merge anything automatically.",
      "- Do not write approved memory.",
      "- Do not directly edit policies, schemas, modes, AGENTS.md, or config unless explicitly required and human-reviewed.",
      "- Do not enable shell/fileWrite/web/git push permissions.",
      "- Keep lab data synthetic and candidate-only.",
      "",
      "Rollback:",
      ...patch.rollbackPlan.map((step) => `- ${step}`)
    ].join("\n");
  }

  private markdown(handoff: CodexHandoff): string {
    return [
      `# ${handoff.handoffId}`,
      "",
      `Patch: ${handoff.patchId}`,
      `Suggested branch: ${handoff.branchSuggested}`,
      "",
      "## Prompt",
      "```md",
      handoff.prompt,
      "```",
      "",
      "## Required Commands",
      ...handoff.requiredCommands.map((command) => `- ${command}`),
      "",
      "## Stop Conditions",
      ...handoff.stopConditions.map((condition) => `- ${condition}`),
      "",
      "## Final Report Required",
      ...handoff.finalReportRequired.map((item) => `- ${item}`)
    ].join("\n");
  }
}
