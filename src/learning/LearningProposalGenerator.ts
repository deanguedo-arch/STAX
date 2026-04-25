import fs from "node:fs/promises";
import path from "node:path";
import type { LearningEvent, LearningProposal } from "./LearningEvent.js";
import { LearningProposalSchema } from "./LearningEvent.js";

const unsafeInstructionPatterns = [
  /ignore (the )?promotion gate/i,
  /edit policy directly/i,
  /modify policies directly/i,
  /auto-?approve/i,
  /skip approval/i,
  /disable schema/i,
  /disable critic/i
];

export class LearningProposalGenerator {
  constructor(private rootDir = process.cwd()) {}

  async generate(event: LearningEvent): Promise<LearningProposal | undefined> {
    if (event.proposedQueues.length === 1 && event.proposedQueues[0] === "trace_only") {
      return undefined;
    }
    const proposalId = `${event.eventId}-proposal`;
    const proposalDir = path.join(this.rootDir, "learning", "proposals");
    await fs.mkdir(proposalDir, { recursive: true });
    const proposalPath = path.join(proposalDir, `${proposalId}.md`);
    const unsafeInstructionsFlagged = unsafeInstructionPatterns
      .filter((pattern) => pattern.test(event.output.raw))
      .map((pattern) => pattern.source);
    await fs.writeFile(proposalPath, this.renderProposal(event, unsafeInstructionsFlagged), "utf8");
    const proposal: LearningProposal = {
      proposalId,
      eventId: event.eventId,
      runId: event.runId,
      queueTypes: event.proposedQueues.filter((queue) => queue !== "trace_only"),
      createdAt: new Date().toISOString(),
      path: proposalPath,
      approvalRequired: true,
      unsafeInstructionsFlagged
    };
    LearningProposalSchema.parse(proposal);
    await fs.writeFile(path.join(proposalDir, `${proposalId}.json`), JSON.stringify(proposal, null, 2), "utf8");
    return proposal;
  }

  private renderProposal(event: LearningEvent, unsafeInstructionsFlagged: string[]): string {
    return [
      "## Weakness Detected",
      `- ${event.failureClassification.explanation}`,
      "",
      "## Root Cause",
      `- Failure types: ${event.failureClassification.failureTypes.join(", ") || "none"}.`,
      `- Specificity score: ${event.qualitySignals.specificityScore}.`,
      "",
      "## Proposed Eval Candidate",
      `- Add a regression case for run ${event.runId} requiring concrete mode output and approval-loop language.`,
      "",
      "## Proposed Correction Candidate",
      "- Create a pending correction only if a user supplies corrected output.",
      "",
      "## Proposed Mode Contract Patch",
      "- Require candidate queues, commands, evidence, rollback, and approval boundaries for weak system-improvement answers.",
      "",
      "## Proposed Codex Prompt",
      "Implement the smallest behavior patch proved by this event. Inspect the linked trace and final output. Add behavior tests before changing mode contracts. Run npm run typecheck, npm test, npm run rax -- eval, and the relevant smoke command. Do not promote memory/evals/training/policies without explicit approval.",
      "",
      "## Unsafe Instructions Flagged",
      ...(unsafeInstructionsFlagged.length
        ? unsafeInstructionsFlagged.map((item) => `- ${item}`)
        : ["- None."]),
      "",
      "## Source",
      `- eventId: ${event.eventId}`,
      `- runId: ${event.runId}`,
      `- trace: ${event.links.tracePath}`,
      `- final: ${event.links.finalPath}`,
      "",
      "## Approval Required",
      "- This proposal is evidence, not authority. It cannot modify source files or promote durable artifacts without an explicit approval command."
    ].join("\n");
  }
}

