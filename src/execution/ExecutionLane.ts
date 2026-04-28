import {
  ExecutionLaneInputSchema,
  ExecutionLaneResultSchema,
  type ExecutionLaneInput,
  type ExecutionLaneResult
} from "./ExecutionLaneSchemas.js";
import { ExecutionRiskGate } from "./ExecutionRiskGate.js";

export class ExecutionLane {
  evaluate(input: ExecutionLaneInput): ExecutionLaneResult {
    const parsed = ExecutionLaneInputSchema.parse(input);
    const blockingReasons = new ExecutionRiskGate().blockingReasons(parsed);
    const allowed = blockingReasons.length === 0 && parsed.requestedStatus !== "rejected";
    return ExecutionLaneResultSchema.parse({
      status: allowed ? parsed.requestedStatus : "rejected",
      allowed,
      blockingReasons,
      requiredNextApproval: nextApproval(parsed, blockingReasons),
      summary: summaryFor(parsed, allowed, blockingReasons)
    });
  }
}

function nextApproval(input: ReturnType<typeof ExecutionLaneInputSchema.parse>, blockers: string[]): string | undefined {
  if (blockers.some((item) => item.includes("sandbox execution"))) return "Approve sandbox execution explicitly.";
  if (blockers.some((item) => item.includes("real apply"))) return "Approve real apply explicitly after reviewing sandbox diff and command evidence.";
  return undefined;
}

function summaryFor(input: ReturnType<typeof ExecutionLaneInputSchema.parse>, allowed: boolean, blockers: string[]): string {
  if (!allowed) return `Execution lane rejected: ${blockers.join("; ") || "requested rejection"}.`;
  if (input.requestedStatus === "ready_for_human_apply") return "Sandbox evidence is ready for human apply decision; STAX still does not apply to the real repo.";
  return `Execution lane status allowed for ${input.requestedStatus}; this gate does not run commands or mutate repos.`;
}
