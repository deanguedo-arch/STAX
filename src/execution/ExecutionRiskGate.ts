import { ExecutionLaneInputSchema, type ExecutionLaneInput } from "./ExecutionLaneSchemas.js";

export class ExecutionRiskGate {
  blockingReasons(input: ExecutionLaneInput): string[] {
    const parsed = ExecutionLaneInputSchema.parse(input);
    const reasons: string[] = [];
    if (parsed.directLinkedRepoMutation) reasons.push("Direct linked-repo mutation is hard-blocked.");
    if (requiresSandbox(parsed.requestedStatus) && !parsed.humanApprovedSandbox) reasons.push("Human approval is required before sandbox execution.");
    if (requiresPatch(parsed.requestedStatus) && !parsed.sandboxPath) reasons.push("Sandbox path is required before patch application.");
    if (requiresCommands(parsed.requestedStatus) && !parsed.patchAppliedToSandbox) reasons.push("Patch must be applied to sandbox before sandbox commands count.");
    if (requiresVerified(parsed.requestedStatus) && (!parsed.commandExitCodes.length || parsed.commandExitCodes.some((code) => code !== 0))) {
      reasons.push("Passing sandbox command evidence is required before ready_for_human_apply.");
    }
    if (parsed.requestedStatus === "ready_for_human_apply" && !parsed.humanApprovedRealApply) {
      reasons.push("Separate human approval is required before any real apply.");
    }
    return reasons;
  }
}

function requiresSandbox(status: string): boolean {
  return !["plan_only", "approval_required", "rejected"].includes(status);
}

function requiresPatch(status: string): boolean {
  return ["patch_applied_to_sandbox", "sandbox_commands_run", "sandbox_verified", "ready_for_human_apply"].includes(status);
}

function requiresCommands(status: string): boolean {
  return ["sandbox_commands_run", "sandbox_verified", "ready_for_human_apply"].includes(status);
}

function requiresVerified(status: string): boolean {
  return ["sandbox_verified", "ready_for_human_apply"].includes(status);
}
