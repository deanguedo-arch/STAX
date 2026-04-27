import type { OperationExecutionResult, OperationPlan } from "./OperationSchemas.js";
import { buildOperationReceipt, renderOperationReceipt, type OperationReceipt } from "./OperationReceipt.js";
import { OperationReceiptValidator } from "./OperationReceiptValidator.js";
import { ProblemMovementGate } from "./ProblemMovementGate.js";
import type { ProblemMovementResult } from "./ProblemMovementSchemas.js";

export class OperationFormatter {
  format(plan: OperationPlan, result: OperationExecutionResult): string {
    const receipt = buildOperationReceipt(plan, result);
    const validation = new OperationReceiptValidator().validate(receipt);
    if (!validation.valid) {
      throw new Error(`OperationReceipt validation failed: ${validation.issues.join("; ")}`);
    }
    const outcome = buildOutcomeHeader(plan, result, receipt);
    const movement = new ProblemMovementGate().evaluate({
      userTask: plan.originalInput,
      intent: plan.intent,
      reasonCodes: plan.reasonCodes,
      riskLevel: plan.riskLevel,
      executionClass: plan.executionClass,
      directAnswer: outcome.directAnswer,
      oneNextStep: outcome.oneNextStep,
      whyThisStep: outcome.whyThisStep,
      proofStatus: outcome.proofStatus,
      receiptStatus: receipt.status,
      evidenceRequired: receipt.evidenceRequired,
      evidenceChecked: receipt.evidenceChecked,
      artifactsCreated: receipt.artifactsCreated,
      claimsVerified: receipt.claimsVerified.map((claim) => claim.claim),
      claimsNotVerified: receipt.claimsNotVerified,
      missingEvidence: receipt.missingEvidence,
      fakeCompleteRisks: receipt.fakeCompleteRisks,
      nextAllowedActions: receipt.nextAllowedActions,
      mutationStatus: receipt.mutationStatus,
      promotionStatus: receipt.promotionStatus
    });
    if (!movement.valid) {
      throw new Error(`ProblemMovementGate validation failed: ${movement.blockingReasons.join("; ")} Required rewrite: ${movement.requiredRewrite ?? "Rewrite the outcome header."}`);
    }
    const output = [
      renderOutcomeHeader(outcome, movement),
      "",
      "## Receipt",
      renderOperationReceipt(receipt),
      "",
      "## Result Detail",
      result.result.trim() || "- No result.",
      "",
      "## Risks / Missing Evidence",
      result.risks.length ? result.risks.map((item) => `- ${item}`).join("\n") : "- None",
      "",
      "## Next Allowed Action",
      result.nextAllowedActions.length ? result.nextAllowedActions.map((item) => `- ${item}`).join("\n") : "- None"
    ].join("\n");
    const markdownValidation = new OperationReceiptValidator().validateMarkdown(output);
    if (!markdownValidation.valid) {
      throw new Error(`OperationReceipt markdown validation failed: ${markdownValidation.issues.join("; ")}`);
    }
    return output;
  }
}

type OutcomeHeader = {
  directAnswer: string;
  oneNextStep: string;
  whyThisStep: string;
  proofStatus: string;
};

function buildOutcomeHeader(plan: OperationPlan, result: OperationExecutionResult, receipt: OperationReceipt): OutcomeHeader {
  return {
    directAnswer: directAnswer(plan, result),
    oneNextStep: oneNextStep(plan, result),
    whyThisStep: whyThisStep(plan, result),
    proofStatus: proofStatus(receipt)
  };
}

function renderOutcomeHeader(outcome: OutcomeHeader, movement: ProblemMovementResult): string {
  return [
    "## Direct Answer",
    outcome.directAnswer,
    "",
    "## One Next Step",
    `- ${outcome.oneNextStep}`,
    "",
    "## Why This Step",
    outcome.whyThisStep,
    "",
    "## Proof Status",
    outcome.proofStatus,
    `ProblemMovement: ${movement.disposition}`,
    `MovementMade: ${movement.movementMade}`,
    "RequiredEvidence:",
    ...(movement.requiredEvidence.length ? movement.requiredEvidence.map((item) => `- ${item}`) : ["- None"])
  ].join("\n");
}

function directAnswer(plan: OperationPlan, result: OperationExecutionResult): string {
  const foundTestsOrScripts = hasTestsOrScripts(result);
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
    return `STAX read the current persisted review queue only. Human-review items: ${human ?? "unknown"}; hard-blocked items: ${blocked ?? "unknown"}; batch-review items: ${batch ?? "unknown"}. No review item was refreshed, applied, approved, rejected, archived, or promoted.`;
  }
  if (plan.intent === "audit_last_proof") {
    return "STAX audited the current thread's last chat-linked run. That proves only what the selected run/trace can support; it does not prove broader repo correctness without command or eval evidence.";
  }
  if (plan.reasonCodes.includes("repo_fix_request_no_mutation") || plan.reasonCodes.includes("workspace_fix_request_no_mutation")) {
    if (foundTestsOrScripts) {
      return "STAX did not modify the repo. It performed read-only inspection and a governed audit; tests or scripts were found, but STAX did not run them, so pass/fail is unknown.";
    }
    return "STAX did not modify the repo. It performed read-only inspection and a governed audit so the next move can be based on evidence instead of a broad fix request.";
  }
  if (isOperatingStateQuestion(plan)) {
    return operatingStateAnswer(result, foundTestsOrScripts);
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

function oneNextStep(plan: OperationPlan, result: OperationExecutionResult): string {
  if (result.blocked) {
    return "Run `npm run rax -- learn queue` to inspect candidates before any approval or promotion path; paste back the output.";
  }
  if (result.deferred || !result.executed) {
    return ensurePasteBack(result.nextAllowedActions[0]?.trim() || "Use the explicit slash or CLI command for this operation and paste back the output.");
  }
  if (isOperatingStateQuestion(plan)) {
    return `Run \`${operatingProofCommand(result)}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and failing command/test names if any.`;
  }
  if (hasTestsOrScripts(result)) {
    return `Run \`${testCommand(result)}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and failing test names if any.`;
  }
  if (plan.intent === "judgment_digest") {
    return "Run `npm run rax -- review inbox` to refresh persisted review metadata; paste back the output if you want STAX to interpret it.";
  }
  if (plan.intent === "audit_last_proof") {
    return "Run the exact verification command named in the audit's Required Next Proof section and paste back the command output.";
  }
  if (plan.intent === "audit_workspace" || plan.intent === "workspace_repo_audit") {
    return "Use the audit's Required Next Proof as the next task, then paste back the resulting command output or Codex final report.";
  }
  return "Paste the missing local evidence or command output named below so STAX can move this from partial to verified.";
}

function whyThisStep(plan: OperationPlan, result: OperationExecutionResult): string {
  if (result.blocked || result.deferred || !result.executed) {
    return "This prevents plain-English chat from silently becoming an approval, promotion, tool, lab, eval, or source-mutation path.";
  }
  if (hasTestsOrScripts(result)) {
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

function proofStatus(receipt: OperationReceipt): string {
  if (receipt.status === "blocked") return "blocked";
  if (receipt.status === "deferred" || receipt.status === "not_executed") return "deferred";
  return receipt.proofQuality === "sufficient" ? "verified" : "partial";
}

function hasTestsOrScripts(result: OperationExecutionResult): boolean {
  return result.evidenceChecked.some((item) => /^repo-(test|script):/.test(item));
}

function scriptNames(result: OperationExecutionResult): string[] {
  return result.evidenceChecked
    .filter((item) => item.startsWith("repo-script:"))
    .map((item) => item.replace("repo-script:", ""))
    .filter(Boolean);
}

function testFiles(result: OperationExecutionResult): string[] {
  return result.evidenceChecked
    .filter((item) => item.startsWith("repo-test:"))
    .map((item) => item.replace("repo-test:", ""))
    .filter(Boolean);
}

function testCommand(result: OperationExecutionResult): string {
  const scripts = scriptNames(result);
  if (scripts.includes("test")) return "npm test";
  const testScript = scripts.find((script) => /test/i.test(script));
  return testScript ? `npm run ${testScript}` : "npm test";
}

function operatingProofCommand(result: OperationExecutionResult): string {
  const scripts = scriptNames(result);
  if (scripts.includes("typecheck")) return "npm run typecheck";
  return testCommand(result);
}

function repoPath(result: OperationExecutionResult): string | undefined {
  return result.evidenceChecked.find((item) => item.startsWith("RepoPath: "))?.replace("RepoPath: ", "");
}

function isOperatingStateQuestion(plan: OperationPlan): boolean {
  return plan.reasonCodes.some((code) => code === "repo_operating_state_question" || code === "workspace_operating_state_question");
}

function operatingStateAnswer(result: OperationExecutionResult, foundTestsOrScripts: boolean): string {
  const risks = sectionItems(result.result, "Risks");
  const missingEvidence = sectionItems(result.result, "Missing Evidence");
  const operationalFiles = sectionItems(result.result, "Operational Files Checked");
  const gitStatus = gitStatusBlock(result.result);
  const testHonesty = foundTestsOrScripts ? " Tests/scripts were found, but STAX did not run them, so pass/fail is unknown." : "";
  const evidenceSuffix = [
    gitStatus && !hasChangedFiles(gitStatus) ? "git status is clean" : undefined,
    operationalFiles.length ? `operational docs inspected (${operationalFiles.slice(0, 2).join(", ")})` : undefined
  ].filter(Boolean).join("; ");

  const lead = highestOperatingRisk(risks, missingEvidence);
  if (lead) {
    return `${lead}${testHonesty}${evidenceSuffix ? ` Verified context: ${evidenceSuffix}.` : ""}`;
  }

  return `No single operational failure was verified from read-only evidence. Current verified state: ${evidenceSuffix || "repo evidence was inspected read-only"}; the remaining unknown is command/test pass-fail because STAX did not run the linked repo.${testHonesty}`;
}

function highestOperatingRisk(risks: string[], missingEvidence: string[]): string | undefined {
  if (risks.includes("git_worktree_has_changes")) {
    return "Biggest verified operating problem: worktree ambiguity. The linked repo has uncommitted changes, so any audit or fix could mix current work with stale assumptions.";
  }
  if (risks.includes("active_handoff_mentions_red_or_failing_test") || risks.includes("active_handoff_has_unvalidated_manual_check")) {
    return "Biggest verified operating problem: handoff/validation drift. The active handoff mentions failing or unvalidated checks, so the next work should first prove the current baseline.";
  }
  if (risks.includes("duplicate_copy_file_names_detected")) {
    return "Biggest verified operating problem: duplicate-file noise. The repo contains copy-style filenames that can make agents edit the wrong surface unless paths are tightly specified.";
  }
  if (risks.includes("no_test_script_detected")) {
    return "Biggest verified operating problem: missing test entrypoint. STAX found no package test script, so proof has to be reconstructed from narrower commands or docs.";
  }
  if (risks.includes("no_test_tree_detected")) {
    return "Biggest verified operating problem: missing test tree. STAX could not verify a test surface from the repo shape.";
  }
  if (risks.includes("git_status_unavailable")) {
    return "Biggest verified operating problem: missing git-status evidence. STAX could inspect files, but it could not verify whether the linked repo is clean.";
  }
  if (missingEvidence.includes("src")) {
    return "Biggest verified operating problem: repo-shape mismatch. The workspace does not expose a conventional src tree, so STAX has to target scripts/tests, e2e, and ops docs instead of using generic repo assumptions.";
  }
  if (missingEvidence.length) {
    return `Biggest verified operating problem: missing expected evidence (${missingEvidence.slice(0, 3).join(", ")}).`;
  }
  return undefined;
}

function sectionItems(markdown: string, heading: string): string[] {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`## ${escaped}\\n([\\s\\S]*?)(?=\\n## |\\nRun: |$)`));
  if (!match?.[1]) return [];
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^-\s+/, "").trim())
    .filter((line) => line && line.toLowerCase() !== "none");
}

function gitStatusBlock(markdown: string): string | undefined {
  const match = markdown.match(/## Git Status\n```txt\n([\s\S]*?)\n```/);
  return match?.[1]?.trim();
}

function hasChangedFiles(gitStatus: string): boolean {
  return /\n\s*[MADRCU?]{1,2}\s+/m.test(gitStatus);
}

function matchResultLine(result: string, pattern: RegExp): string | undefined {
  return result.match(pattern)?.[1];
}

function ensurePasteBack(step: string): string {
  if (/\bpaste back\b/i.test(step)) return step;
  if (/\b(npm|pnpm|yarn|tsx|vitest|rax|CLI|command)\b/i.test(step)) {
    return `${step}; paste back the output.`;
  }
  return step;
}
