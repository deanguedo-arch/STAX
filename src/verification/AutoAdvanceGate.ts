import { AutonomyWindowController } from "./AutonomyWindow.js";
import {
  AutoAdvanceGateInputSchema,
  AutoAdvanceGateResultSchema,
  MicroStepSchema,
  type AutoAdvanceGateInput,
  type AutoAdvanceGateResult,
  type ParsedMicroStep,
  type VerificationTier
} from "./VerificationEconomySchemas.js";

export class AutoAdvanceGate {
  evaluate(input: AutoAdvanceGateInput): AutoAdvanceGateResult {
    const parsed = AutoAdvanceGateInputSchema.parse(input);
    const controller = new AutonomyWindowController();
    const window = parsed.window ? parsed.window : controller.forPacket(parsed.packet);
    const step = MicroStepSchema.parse(parsed.step);
    const repeatedCount = parsed.completedSteps.filter((completed) => sameStep(MicroStepSchema.parse(completed), step)).length + 1;
    const commandCount = parsed.completedSteps.filter((item) => MicroStepSchema.parse(item).command).length + (step.command ? 1 : 0);
    const touchedFiles = [...parsed.completedSteps.flatMap((item) => MicroStepSchema.parse(item).files), ...step.files];

    if (repeatedCount >= 3) {
      return result("hard_stop", step, {
        hardStopReason: "Repeated same micro-step three times.",
        reasons: ["Repeated same micro-step three times; stop instead of looping."]
      });
    }

    const forbiddenFile = controller.hasForbiddenFile(step.files, window);
    if (forbiddenFile) {
      return result("hard_stop", step, {
        hardStopReason: `${forbiddenFile} matches a forbidden file boundary.`,
        reasons: [`${forbiddenFile} matches a forbidden file boundary.`]
      });
    }

    if (step.command && controller.isCommandHardBlocked(step.command, window)) {
      return result("hard_stop", step, {
        hardStopReason: `${step.command} is hard-blocked for this packet.`,
        reasons: [`${step.command} is hard-blocked for this packet.`]
      });
    }

    if (step.command && !controller.isCommandAllowed(step.command, window)) {
      return result("hard_stop", step, {
        hardStopReason: `${step.command} is not allowlisted for this packet.`,
        reasons: [`${step.command} is not allowlisted for this packet.`]
      });
    }

    const disallowedFile = controller.hasDisallowedFile(step.files, window);
    if (disallowedFile) {
      return result("hard_stop", step, {
        hardStopReason: `${disallowedFile} is outside the allowed file window.`,
        reasons: [`${disallowedFile} is outside the allowed file window.`]
      });
    }

    if (/delete|remove|unlink/i.test(step.description) && step.files.includes("package-lock.json") && !window.humanApprovedWindow) {
      return result("hard_stop", step, {
        hardStopReason: "package-lock deletion requires explicit approval outside this packet.",
        reasons: ["package-lock deletion requires explicit approval outside this packet."]
      });
    }

    if (!controller.withinBudget({ touchedFiles, commandCount, microStepCount: parsed.completedSteps.length + 1, window })) {
      return result("checkpoint_required", step, {
        nextCheckpoint: "Record packet status before continuing beyond the autonomy window budget.",
        reasons: ["Autonomy window budget reached; checkpoint before continuing."]
      });
    }

    if (step.exitCode !== undefined && step.exitCode !== 0) {
      return result("checkpoint_required", step, {
        firstRemainingFailure: `${step.command ?? step.description} failed with exit code ${step.exitCode}.`,
        nextCheckpoint: "Record first remaining failure and reassess before continuing.",
        reasons: ["Failed command requires a checkpoint and first remaining failure report."]
      });
    }

    if (requiresApproval(step)) {
      if (window.humanApprovedWindow && isAllowedMutation(step.kind)) {
        return result("checkpoint_required", step, {
          nextCheckpoint: "Record diff allowlist proof after the approved mutation.",
          reasons: ["Approved mutation stays inside the window but requires checkpoint proof."]
        });
      }
      return result("approval_required", step, {
        firstRealBoundary: `${step.description} requires human approval before continuing.`,
        reasons: ["Mutation, dependency repair, sandbox patching, or scope expansion is a real authority boundary."]
      });
    }

    if (step.kind === "targeted_command" || step.kind === "full_gate_command") {
      return result("checkpoint_required", step, {
        nextCheckpoint: `Record proof for ${step.command ?? step.description}.`,
        reasons: ["Allowed proof command requires checkpoint evidence before continuing."]
      });
    }

    if (step.kind === "goal_verification" && step.passed) {
      return result("done", step, { reasons: ["Packet goal is verified."] });
    }

    return result("auto_continue", step, {
      reasons: ["Reversible, read-only, structural, or prompt-drafting micro-step; do not ask Dean."]
    });
  }
}

function result(
  decision: AutoAdvanceGateResult["decision"],
  step: ParsedMicroStep,
  overrides: Partial<AutoAdvanceGateResult>
): AutoAdvanceGateResult {
  return AutoAdvanceGateResultSchema.parse({
    decision,
    verificationTier: tierFor(step),
    requiresHumanNow: decision === "approval_required",
    verificationRequiredNow: decision === "checkpoint_required" || decision === "done",
    checkpointGroup: "dependency_repair_packet",
    riskIfDeferred: decision === "hard_stop" ? "high" : "low",
    reasons: [],
    ...overrides
  });
}

function tierFor(step: ParsedMicroStep): VerificationTier {
  if (["read_only_inspection", "evidence_classification", "prompt_drafting", "summary"].includes(step.kind)) return "tier_0_none";
  if (step.kind === "structural_check") return "tier_1_structural";
  if (step.kind === "targeted_command") return "tier_2_targeted_command";
  if (step.kind === "full_gate_command" || step.kind === "goal_verification") return "tier_3_full_gate";
  return "tier_4_human_judgment";
}

function requiresApproval(step: ParsedMicroStep): boolean {
  return ["dependency_repair", "sandbox_patching", "file_mutation", "scope_expansion", "human_judgment"].includes(step.kind);
}

function isAllowedMutation(kind: ParsedMicroStep["kind"]): boolean {
  return ["dependency_repair", "sandbox_patching", "file_mutation"].includes(kind);
}

function sameStep(a: ParsedMicroStep, b: ParsedMicroStep): boolean {
  return a.id === b.id || a.description.toLowerCase() === b.description.toLowerCase();
}
