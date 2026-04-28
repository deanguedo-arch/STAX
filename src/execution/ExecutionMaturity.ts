import {
  ExecutionMaturityInputSchema,
  ExecutionMaturityResultSchema,
  type ExecutionMaturityInput,
  type ExecutionMaturityResult
} from "./ExecutionMaturitySchemas.js";

export class ExecutionMaturity {
  evaluate(input: ExecutionMaturityInput): ExecutionMaturityResult {
    const parsed = ExecutionMaturityInputSchema.parse(input);
    const levels = [
      "level_0_answer_only",
      "level_1_evidence_request",
      "level_2_patch_plan",
      "level_3_sandbox_patch",
      "level_4_sandbox_verified",
      "level_5_human_approved_apply",
      "level_6_monitored_release"
    ] as const;
    let index = 0;
    if (parsed.hasEvidenceRequest) index = 1;
    if (parsed.hasPatchPlan) index = 2;
    if (parsed.sandboxPatchApplied) index = 3;
    if (parsed.commandEvidencePassed) index = 4;
    if (parsed.humanApprovedApply) index = 5;
    if (parsed.releaseEvidence) index = 6;
    const blockingReasons = blockers(parsed);
    const currentLevel = levels[Math.min(index, firstInvalidIndex(parsed))] ?? "level_0_answer_only";
    const currentIndex = levels.indexOf(currentLevel);
    return ExecutionMaturityResultSchema.parse({
      currentLevel,
      nextLevel: levels[currentIndex + 1],
      needed: neededFor(currentLevel),
      blockingReasons
    });
  }
}

function firstInvalidIndex(input: ReturnType<typeof ExecutionMaturityInputSchema.parse>): number {
  if (input.releaseEvidence && !input.humanApprovedApply) return 5;
  if (input.humanApprovedApply && !input.commandEvidencePassed) return 4;
  if (input.commandEvidencePassed && !input.sandboxPatchApplied) return 3;
  if (input.sandboxPatchApplied && !input.hasPatchPlan) return 2;
  if (input.hasPatchPlan && !input.hasEvidenceRequest) return 1;
  return 6;
}

function blockers(input: ReturnType<typeof ExecutionMaturityInputSchema.parse>): string[] {
  const blockers: string[] = [];
  if (input.sandboxPatchApplied && !input.hasPatchPlan) blockers.push("Sandbox patch cannot count without a patch plan.");
  if (input.commandEvidencePassed && !input.sandboxPatchApplied) blockers.push("Command evidence cannot prove level_4 without sandbox patch evidence.");
  if (input.humanApprovedApply && !input.commandEvidencePassed) blockers.push("Human-approved apply cannot count without passing command evidence.");
  if (input.releaseEvidence && !input.humanApprovedApply) blockers.push("Monitored release cannot count without human-approved apply evidence.");
  return blockers;
}

function neededFor(level: ExecutionMaturityResult["currentLevel"]): string[] {
  if (level === "level_0_answer_only") return ["minimum evidence request"];
  if (level === "level_1_evidence_request") return ["patch plan"];
  if (level === "level_2_patch_plan") return ["human-approved sandbox patch"];
  if (level === "level_3_sandbox_patch") return ["passing scoped command evidence"];
  if (level === "level_4_sandbox_verified") return ["separate human approval before real apply"];
  if (level === "level_5_human_approved_apply") return ["monitored release evidence"];
  return [];
}
