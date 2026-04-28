import type { OperationExecutionResult, OperationPlan } from "./OperationSchemas.js";
import {
  boundedPromptCommand,
  dependencyInspectionComplete,
  dependencyRepairBlocker,
  ensurePasteBack,
  evidenceRequestFor,
  failedCommandEvidence,
  hasTestsOrScripts,
  isOperatingStateQuestion,
  operatingProofCommand,
  renderedPreviewProofNeed,
  repoPath,
  syncBoundaryStep,
  testCommand,
  verificationDebtCommand
} from "./OperatorEvidenceAdapters.js";
import { judgmentPacketFor } from "./OperatorJudgmentAdapter.js";
import { visualEvidenceFor, visualNextStep } from "./OperatorVisualAdapter.js";

export class NextStepBuilder {
  build(plan: OperationPlan, result: OperationExecutionResult): string {
    const failedCommand = failedCommandEvidence(plan, result);
    const dependencyBlocker = dependencyRepairBlocker(plan, result);
    const inspectedDependencyBlocker = dependencyBlocker && dependencyInspectionComplete(plan, result);
    const renderedPreviewNeed = renderedPreviewProofNeed(plan);
    if (result.blocked) {
      return "Run `npm run rax -- learn queue` to inspect candidates before any approval or promotion path; paste back the output.";
    }
    if (result.deferred || !result.executed) {
      return ensurePasteBack(result.nextAllowedActions[0]?.trim() || "Use the explicit slash or CLI command for this operation and paste back the output.");
    }
    if (isOperatingStateQuestion(plan)) {
      if (renderedPreviewNeed) {
        return visualNextStep(plan);
      }
      const syncBoundary = syncBoundaryStep(result);
      if (syncBoundary) return syncBoundary;
      if (failedCommand) {
        if (dependencyBlocker) {
          if (inspectedDependencyBlocker) {
            return `Ask for human approval to repair the missing Rollup optional dependency in ${repoPath(result) ?? "the target repo"}; paste back the approval decision before any dependency install or deletion command runs.`;
          }
          return `Run \`npm ls @rollup/rollup-darwin-arm64 rollup vite\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and dependency tree lines for the missing package.`;
        }
        return `Run \`${failedCommand.command}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and the first failing error block.`;
      }
      const debtCommand = verificationDebtCommand(result);
      if (debtCommand) {
        return `Run \`${debtCommand}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and failing command/test names if any.`;
      }
      return `Run \`${operatingProofCommand(result, plan.originalInput)}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and failing command/test names if any.`;
    }
    if (plan.intent === "codex_report_audit") {
      if (failedCommand) {
        if (dependencyBlocker && inspectedDependencyBlocker) {
          return `Ask for human approval to repair the missing Rollup optional dependency in ${repoPath(result) ?? "the target repo"}; paste back the approval decision before any dependency install or deletion command runs.`;
        }
        return `Run \`${failedCommand.command}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, plus the Codex file list and diff summary if available.`;
      }
      const debtCommand = verificationDebtCommand(result);
      return `Run \`${debtCommand ?? testCommand(result, plan.originalInput)}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, plus the Codex file list and diff summary if available.`;
    }
    if (plan.reasonCodes.includes("workspace_codex_prompt_request")) {
      if (dependencyBlocker) {
        return `Ask for human approval to open the dependency repair bounded sandbox window for ${repoPath(result) ?? "the target repo"}; paste back the approval decision before any dependency repair runs.`;
      }
      return `Run \`${boundedPromptCommand(result) ?? testCommand(result, plan.originalInput)}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and the Codex final report.`;
    }
    if (failedCommand) {
      if (dependencyBlocker) {
        if (inspectedDependencyBlocker) {
          return `Ask for human approval to repair the missing Rollup optional dependency in ${repoPath(result) ?? "the target repo"}; paste back the approval decision before any dependency install or deletion command runs.`;
        }
        return `Run \`npm ls @rollup/rollup-darwin-arm64 rollup vite\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and dependency tree lines for the missing package.`;
      }
      return `Run \`${failedCommand.command}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and the first failing error block.`;
    }
    if (renderedPreviewNeed) {
      return visualNextStep(plan);
    }
    if (hasTestsOrScripts(result)) {
      const debtCommand = verificationDebtCommand(result);
      if (debtCommand) {
        return `Run \`${debtCommand}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and failing command/test names if any.`;
      }
      return `Run \`${testCommand(result, plan.originalInput)}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and failing test names if any.`;
    }
    if (plan.intent === "judgment_digest") {
      const packet = judgmentPacketFor(plan, result);
      return `Run \`npm run rax -- review inbox\` to refresh persisted review metadata; paste back the output if you want STAX to interpret it. JudgmentPacket recommends ${packet.recommendedOption}.`;
    }
    if (plan.intent === "audit_last_proof") {
      return "Run the exact verification command named in the audit's Required Next Proof section and paste back the command output.";
    }
    if (plan.intent === "audit_workspace" || plan.intent === "workspace_repo_audit") {
      return "Use the audit's Required Next Proof as the next task, then paste back the resulting command output or Codex final report.";
    }
    return evidenceRequestFor(plan, result).pasteBackInstructions;
  }

  why(plan: OperationPlan, result: OperationExecutionResult): string {
    if (result.blocked || result.deferred || !result.executed) {
      return "This prevents plain-English chat from silently becoming an approval, promotion, tool, lab, eval, or source-mutation path.";
    }
    const failedCommand = failedCommandEvidence(plan, result);
    const dependencyBlocker = dependencyRepairBlocker(plan, result);
    const inspectedDependencyBlocker = dependencyBlocker && dependencyInspectionComplete(plan, result);
    const renderedPreviewNeed = renderedPreviewProofNeed(plan);
    if (renderedPreviewNeed) {
      const visual = visualEvidenceFor(plan);
      return `The user's problem is visual containment in the rendered workspace, so screenshot or rendered-preview evidence is the proof boundary before any fix can be called done. VisualEvidenceProtocol requires: ${visual.requiredNextEvidence.join("; ")}`;
    }
    if (failedCommand) {
      if (inspectedDependencyBlocker) {
        return "The non-mutating dependency inspection is already done; dependency repair can change the local install state, so the next useful move is a human approval boundary before running any repair command.";
      }
      if (dependencyBlocker) {
        return "The named proof command already failed before behavior could be verified; inspecting the dependency tree is the smallest non-mutating step before any human-approved dependency repair.";
      }
      return "The named proof command already failed, so the next useful move is to capture the failing output instead of switching to an unrelated proof command.";
    }
    if (hasTestsOrScripts(result)) {
      if (plan.reasonCodes.includes("workspace_codex_prompt_request")) {
        if (dependencyBlocker) {
          return "The safe micro-steps are already compressed into the Auto-Advanced packet; dependency repair is the first real authority boundary, so STAX should ask once for a bounded window instead of asking about each tiny step.";
        }
        return "The bounded prompt named one proof command for the target repo; that command is the proof boundary before claiming the patch worked.";
      }
      return "Static repo evidence can show that tests or scripts exist, but only command output can prove whether they pass or fail.";
    }
    if (plan.intent === "judgment_digest") {
      return "The visible queue can be stale; refreshing is a separate explicit action so review metadata is not silently changed.";
    }
    if (plan.intent === "audit_last_proof") {
      return "Run/trace evidence narrows what happened, but a verification command is still needed before claiming the underlying behavior works.";
    }
    return "The operator has partial local evidence; the next step should reduce the most important uncertainty instead of adding more paperwork.";
  }
}
