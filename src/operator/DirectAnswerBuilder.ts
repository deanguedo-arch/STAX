import type { OperationExecutionResult, OperationPlan } from "./OperationSchemas.js";
import {
  commandEvidenceStatements,
  dependencyInspectionComplete,
  dependencyRepairBlocker,
  failedCommandEvidence,
  hasTestsOrScripts,
  isOperatingStateQuestion,
  matchResultLine,
  operatingStateAnswer,
  renderedPreviewProofNeed,
  scriptNames,
  storedCommandEvidenceStatements,
  summarizeCommandEvidence,
  testFiles
} from "./OperatorEvidenceAdapters.js";
import { judgmentPacketFor } from "./OperatorJudgmentAdapter.js";
import { visualEvidenceFor } from "./OperatorVisualAdapter.js";

export class DirectAnswerBuilder {
  build(plan: OperationPlan, result: OperationExecutionResult): string {
    const foundTestsOrScripts = hasTestsOrScripts(result);
    const suppliedCommandEvidence = commandEvidenceStatements(plan.originalInput);
    const storedCommandEvidence = storedCommandEvidenceStatements(result);
    const failedCommand = failedCommandEvidence(plan, result);
    const dependencyBlocker = dependencyRepairBlocker(plan, result);
    const inspectedDependencyBlocker = dependencyBlocker && dependencyInspectionComplete(plan, result);
    const renderedPreviewNeed = renderedPreviewProofNeed(plan);
    if (result.blocked) {
      return "Blocked. STAX did not execute the requested operation, approve anything, promote anything, or mutate durable state.";
    }
    if (result.deferred || !result.executed) {
      return "Deferred. STAX did not execute this operation or mutate durable state; use the explicit slash or CLI path if you want to proceed.";
    }
    if (plan.intent === "judgment_digest") {
      const human = matchResultLine(result.result, /human_review:\s*(\d+)/i);
      const blocked = matchResultLine(result.result, /hard_block:\s*(\d+)/i);
      const batch = matchResultLine(result.result, /batch_review:\s*(\d+)/i);
      const packet = judgmentPacketFor(plan, result);
      return `STAX read the current persisted review queue only. Human-review items: ${human ?? "unknown"}; hard-blocked items: ${blocked ?? "unknown"}; batch-review items: ${batch ?? "unknown"}. JudgmentPacket: requiresHumanApproval=${packet.requiresHumanApproval}; recommendedOption=${packet.recommendedOption}. No review item was refreshed, applied, approved, rejected, archived, or promoted.`;
    }
    if (plan.intent === "audit_last_proof") {
      return "STAX audited the current thread's last chat-linked run. That proves only what the selected run/trace can support; it does not prove broader repo correctness without command or eval evidence.";
    }
    if (plan.intent === "codex_report_audit") {
      if (failedCommand) {
        const sourceLabel = failedCommand.source === "supplied" ? "User-supplied command evidence" : "Stored command evidence";
        return [
          "STAX treated the supplied Codex report as unverified until it has file lists, diff summary, and command output.",
          `${sourceLabel} says \`${failedCommand.command}\` failed, so any claim that all tests pass is contradicted or at least unsupported by the current proof state.`,
          "It inspected the linked repo read-only; no approval, promotion, or source mutation happened."
        ].join(" ");
      }
      return [
        "STAX treated the supplied Codex report as unverified until it has file lists, diff summary, and command output.",
        foundTestsOrScripts ? "Tests/scripts were found by read-only inspection, but STAX did not run them, so pass/fail is unknown." : "No executable proof command was run.",
        "It inspected the linked repo read-only; no approval, promotion, or source mutation happened."
      ].join(" ");
    }
    if (plan.reasonCodes.includes("repo_fix_request_no_mutation") || plan.reasonCodes.includes("workspace_fix_request_no_mutation")) {
      if (foundTestsOrScripts) {
        return "STAX did not modify the repo. It performed read-only inspection and a governed audit; tests or scripts were found, but STAX did not run them, so pass/fail is unknown.";
      }
      return "STAX did not modify the repo. It performed read-only inspection and a governed audit so the next move can be based on evidence instead of a broad fix request.";
    }
    if (plan.reasonCodes.includes("workspace_codex_prompt_request")) {
      return [
        "STAX created a bounded Codex prompt candidate from read-only repo evidence.",
        foundTestsOrScripts ? "Tests/scripts were found, but STAX did not run them, so pass/fail is unknown." : "No executable proof command was run.",
        "The prompt is candidate-only and did not mutate the linked repo."
      ].join(" ");
    }
    if (failedCommand) {
      const sourceLabel = failedCommand.source === "supplied" ? "User-supplied command evidence" : "Stored command evidence";
      return [
        `${sourceLabel} says \`${failedCommand.command}\` failed, so the current blocker is the failed proof gate rather than ordinary unrun tests.`,
        inspectedDependencyBlocker ? `The dependency inspection has already been supplied and still points at ${dependencyBlocker}, so the next decision is whether to approve dependency repair.` : dependencyBlocker ? `The failure appears to be a dependency/install integrity blocker (${dependencyBlocker}), so STAX should not claim repo behavior passed or move on to generic test commands.` : "STAX should not claim repo behavior passed or move on to generic test commands until the failed command is explained.",
        "Treat this as partial proof for that failed command only; no repair, approval, promotion, or source mutation happened."
      ].join(" ");
    }
    if (renderedPreviewNeed) {
      const visual = visualEvidenceFor(plan);
      return `Biggest verified problem: rendered-preview uncertainty for the named workspace surface. VisualEvidenceProtocol: ${visual.status}. Source files and scripts are useful context, but tests/scripts were not run so pass/fail is unknown, and they do not prove ${visual.unverifiedClaims.join(", ")} without rendered preview evidence.`;
    }
    if (isOperatingStateQuestion(plan)) {
      return operatingStateAnswer(result, foundTestsOrScripts);
    }
    if ((suppliedCommandEvidence.length || storedCommandEvidence.length) && (plan.intent === "audit_workspace" || plan.intent === "workspace_repo_audit")) {
      const sourceLabel = suppliedCommandEvidence.length ? "User-supplied command evidence" : "Stored command evidence";
      const statements = suppliedCommandEvidence.length ? suppliedCommandEvidence : storedCommandEvidence;
      return [
        `${sourceLabel} says ${summarizeCommandEvidence(statements)}.`,
        foundTestsOrScripts ? "STAX also found test/script evidence by read-only inspection." : "STAX also inspected the target repo read-only.",
        "Treat this as partial proof for the named commands only; it does not prove full repo behavior or approve any mutation."
      ].join(" ");
    }
    if (foundTestsOrScripts) {
      const scripts = scriptNames(result);
      const tests = testFiles(result);
      return `STAX found ${scripts.length ? `test/script evidence (${scripts.join(", ")})` : "no package test scripts"} and ${tests.length ? `${tests.length} test file(s)` : "no test files"} by read-only inspection, but it did not run tests; pass/fail is unknown.`;
    }
    if (plan.intent === "audit_workspace" || plan.intent === "workspace_repo_audit") {
      return "STAX performed a read-only audit of the target workspace/repo. No source files were modified, and proof remains partial until the relevant commands or runtime checks are run.";
    }
    return "STAX handled this recognized operator request without approving, promoting, training, merging, or mutating durable system state.";
  }
}
