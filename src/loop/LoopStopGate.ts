import {
  LoopStopGateInputSchema,
  LoopStopGateResultSchema,
  type LoopStopGateInput,
  type LoopStopGateResult
} from "./SandboxLoopSchemas.js";

export class LoopStopGate {
  evaluate(input: LoopStopGateInput): LoopStopGateResult {
    const parsed = LoopStopGateInputSchema.parse(input);
    if (parsed.goalVerified) {
      return stop("goal_verified", "Goal verified; stop before doing extra work.");
    }
    if (parsed.forbiddenDiff) {
      return stop("forbidden_diff", "Forbidden diff detected; stop the sandbox loop.");
    }
    if (parsed.nonAllowlistedCommand) {
      return stop("non_allowlisted_command", "Non-allowlisted command requested; stop the sandbox loop.");
    }
    if (parsed.failedCommand) {
      return stop("failed_command", "Command failed; stop and report the first remaining failure.");
    }
    if (hasThreeRepeatedSteps(parsed.plannedStepIds)) {
      return stop("same_next_step_repeated_3_times", "Same next step repeated three times; stop to avoid looping.");
    }
    if (parsed.patchFailures >= 2) {
      return stop("two_patch_failures", "Two patch failures reached; stop before grinding.");
    }
    if (parsed.needsHumanDecision) {
      return stop("needs_human_decision", "Human decision boundary reached.");
    }
    if (parsed.loopCount >= parsed.budget.maxLoops) {
      return stop("max_loops_reached", "Loop budget reached.");
    }
    return LoopStopGateResultSchema.parse({
      shouldStop: false,
      reason: "none",
      summary: "Loop may continue inside the approved sandbox boundary."
    });
  }
}

function stop(reason: Exclude<LoopStopGateResult["reason"], "none">, summary: string): LoopStopGateResult {
  return LoopStopGateResultSchema.parse({
    shouldStop: true,
    reason,
    summary
  });
}

function hasThreeRepeatedSteps(stepIds: string[]): boolean {
  if (stepIds.length < 3) return false;
  const last = stepIds.slice(-3);
  return last.every((step) => step === last[0]);
}
