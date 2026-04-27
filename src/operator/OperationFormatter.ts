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
  const suppliedCommandEvidence = commandEvidenceStatements(plan.originalInput);
  const storedCommandEvidence = storedCommandEvidenceStatements(result);
  const failedCommand = failedCommandEvidence(plan, result);
  const dependencyBlocker = dependencyRepairBlocker(plan, result);
  const inspectedDependencyBlocker = dependencyBlocker && dependencyInspectionComplete(plan, result);
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
  if (plan.intent === "codex_report_audit") {
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

function oneNextStep(plan: OperationPlan, result: OperationExecutionResult): string {
  const failedCommand = failedCommandEvidence(plan, result);
  const dependencyBlocker = dependencyRepairBlocker(plan, result);
  const inspectedDependencyBlocker = dependencyBlocker && dependencyInspectionComplete(plan, result);
  if (result.blocked) {
    return "Run `npm run rax -- learn queue` to inspect candidates before any approval or promotion path; paste back the output.";
  }
  if (result.deferred || !result.executed) {
    return ensurePasteBack(result.nextAllowedActions[0]?.trim() || "Use the explicit slash or CLI command for this operation and paste back the output.");
  }
  if (isOperatingStateQuestion(plan)) {
    if (failedCommand) {
      if (dependencyBlocker) {
        if (inspectedDependencyBlocker) {
          return `Ask for human approval to repair the missing Rollup optional dependency in ${repoPath(result) ?? "the target repo"}; paste back the approval decision before any dependency install or deletion command runs.`;
        }
        return `Run \`npm ls @rollup/rollup-darwin-arm64 rollup vite\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and dependency tree lines for the missing package.`;
      }
      return `Rerun \`${failedCommand.command}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and the first failing error block.`;
    }
    const debtCommand = verificationDebtCommand(result);
    if (debtCommand) {
      return `Run \`${debtCommand}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and failing command/test names if any.`;
    }
    return `Run \`${operatingProofCommand(result, plan.originalInput)}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and failing command/test names if any.`;
  }
  if (plan.intent === "codex_report_audit") {
    const debtCommand = verificationDebtCommand(result);
    return `Run \`${debtCommand ?? testCommand(result, plan.originalInput)}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, plus the Codex file list and diff summary if available.`;
  }
  if (plan.reasonCodes.includes("workspace_codex_prompt_request")) {
    return `Run \`${boundedPromptCommand(result) ?? testCommand(result, plan.originalInput)}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and the Codex final report.`;
  }
  if (failedCommand) {
    if (dependencyBlocker) {
      if (inspectedDependencyBlocker) {
        return `Ask for human approval to repair the missing Rollup optional dependency in ${repoPath(result) ?? "the target repo"}; paste back the approval decision before any dependency install or deletion command runs.`;
      }
      return `Run \`npm ls @rollup/rollup-darwin-arm64 rollup vite\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and dependency tree lines for the missing package.`;
    }
    return `Rerun \`${failedCommand.command}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and the first failing error block.`;
  }
  if (hasTestsOrScripts(result)) {
    const debtCommand = verificationDebtCommand(result);
    if (debtCommand) {
      return `Run \`${debtCommand}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and failing command/test names if any.`;
    }
    return `Run \`${testCommand(result, plan.originalInput)}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and failing test names if any.`;
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
  const failedCommand = failedCommandEvidence(plan, result);
  const dependencyBlocker = dependencyRepairBlocker(plan, result);
  const inspectedDependencyBlocker = dependencyBlocker && dependencyInspectionComplete(plan, result);
  if (failedCommand) {
    if (inspectedDependencyBlocker) {
      return "The non-mutating dependency inspection is already done; dependency repair can change the local install state, so the next useful move is a human approval boundary before running any repair command.";
    }
    if (dependencyBlocker) {
      return `The named proof command already failed before behavior could be verified; inspecting the dependency tree is the smallest non-mutating step before any human-approved dependency repair.`;
    }
    return `The named proof command already failed, so the next useful move is to capture the failing output instead of switching to an unrelated proof command.`;
  }
  if (hasTestsOrScripts(result)) {
    if (plan.reasonCodes.includes("workspace_codex_prompt_request")) {
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

function testCommand(result: OperationExecutionResult, originalInput = ""): string {
  const scripts = scriptNames(result);
  const supplied = suppliedNpmRunScripts(originalInput);
  for (const script of storedNpmRunScripts(result)) supplied.add(script);
  if (scripts.includes("test") && !supplied.has("test")) return "npm test";
  const testScript = scripts.find((script) => /test/i.test(script) && !supplied.has(script)) ||
    scripts.find((script) => /test/i.test(script));
  if (testScript) return `npm run ${testScript}`;
  const proofScript = scripts.find((script) => /typecheck|check|build|lint|ci/i.test(script) && !supplied.has(script)) ||
    scripts.find((script) => /typecheck|check|build|lint|ci/i.test(script)) ||
    scripts.find((script) => !supplied.has(script)) ||
    scripts[0];
  return proofScript ? `npm run ${proofScript}` : "npm test";
}

function operatingProofCommand(result: OperationExecutionResult, originalInput = ""): string {
  const scripts = scriptNames(result);
  const supplied = suppliedNpmRunScripts(originalInput);
  for (const script of storedNpmRunScripts(result)) supplied.add(script);
  if (scripts.includes("typecheck") && !supplied.has("typecheck")) return "npm run typecheck";
  return testCommand(result, originalInput);
}

function boundedPromptCommand(result: OperationExecutionResult): string | undefined {
  const match = result.result.match(/## Bounded Codex Prompt Candidate[\s\S]*?## Commands To Run\s*\n-\s*([^\n]+)/);
  return match?.[1]?.trim();
}

function repoPath(result: OperationExecutionResult): string | undefined {
  return result.evidenceChecked.find((item) => item.startsWith("RepoPath: "))?.replace("RepoPath: ", "");
}

function isOperatingStateQuestion(plan: OperationPlan): boolean {
  return plan.reasonCodes.some((code) =>
    code === "repo_operating_state_question" ||
    code === "workspace_operating_state_question" ||
    code === "repo_risk_question" ||
    code === "workspace_risk_question"
  );
}

function operatingStateAnswer(result: OperationExecutionResult, foundTestsOrScripts: boolean): string {
  const risks = sectionItems(result.result, "Risks");
  const missingEvidence = sectionItems(result.result, "Missing Evidence");
  const operationalFiles = sectionItems(result.result, "Operational Files Checked");
  const gitStatus = gitStatusBlock(result.result);
  const testHonesty = foundTestsOrScripts ? " Tests/scripts were found, but STAX did not run them, so pass/fail is unknown." : "";
  const evidenceSuffix = [
    gitStatus && !hasChangedFiles(gitStatus) && !branchDrift(gitStatus) ? "git status is clean" : undefined,
    operationalFiles.length ? `operational docs inspected (${operationalFiles.slice(0, 2).join(", ")})` : undefined
  ].filter(Boolean).join("; ");

  const gitRisk = gitStatusRisk(gitStatus);
  if (gitRisk) {
    return `${gitRisk}${testHonesty}${evidenceSuffix ? ` Verified context: ${evidenceSuffix}.` : ""}`;
  }

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

function branchDrift(gitStatus: string): boolean {
  return /\[(?:ahead|behind|gone|diverged)[^\]]*\]/i.test(gitStatus);
}

function gitStatusRisk(gitStatus?: string): string | undefined {
  if (!gitStatus) return undefined;
  const firstLine = gitStatus.split(/\r?\n/)[0] ?? "";
  if (/\[behind\s+(\d+)\]/i.test(firstLine)) {
    const count = firstLine.match(/\[behind\s+(\d+)\]/i)?.[1];
    return `Biggest verified operating problem: stale branch. The linked repo is behind origin${count ? ` by ${count} commit(s)` : ""}, so local audit results may be outdated until the repo is pulled.`;
  }
  if (/\[(?:ahead|diverged)[^\]]*\]/i.test(firstLine)) {
    return "Biggest verified operating problem: branch drift. The linked repo is not aligned with origin, so proof needs a clean sync boundary before broad claims.";
  }
  if (hasChangedFiles(gitStatus)) {
    return "Biggest verified operating problem: worktree ambiguity. The linked repo has uncommitted changes, so any audit or fix could mix current work with stale assumptions.";
  }
  return undefined;
}

function commandEvidenceStatements(input: string): string[] {
  const statements = new Set<string>();
  const patterns = [
    /\bnpm run ([a-z0-9:_-]+)\s+(passed|failed)(?:\s+\d+\s*\/\s*\d+)?\b/gi,
    /\bnpm test\s+(passed|failed)\b/gi,
    /\bnpx tsx --test\s+(.+?)\s+passed\s+(\d+\s*\/\s*\d+)?(?=;|\.|$)/gi
  ];
  for (const pattern of patterns) {
    for (const match of input.matchAll(pattern)) {
      if (match[0]) statements.add(match[0].trim().replace(/\s+/g, " "));
    }
  }
  return Array.from(statements);
}

function storedCommandEvidenceStatements(result: OperationExecutionResult): string[] {
  return result.evidenceChecked
    .map((item) => item.match(/^command-evidence:[^:]+:(.+):(passed|failed|partial|unknown):(human_pasted_command_output|codex_reported_command_output|local_stax_command_output)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => `${match[1]} ${match[2]}`);
}

function summarizeCommandEvidence(statements: string[]): string {
  const unique = Array.from(new Set(statements));
  if (unique.length <= 4) return unique.join("; ");
  const passed = unique.filter((item) => /\bpassed$/i.test(item)).length;
  const failed = unique.filter((item) => /\bfailed$/i.test(item)).length;
  const unknown = unique.length - passed - failed;
  const examples = unique.slice(0, 3).join("; ");
  return `${unique.length} stored command result(s) (${passed} passed, ${failed} failed, ${unknown} partial/unknown), including ${examples}`;
}

function suppliedNpmRunScripts(input: string): Set<string> {
  const scripts = new Set<string>();
  for (const match of input.matchAll(/\bnpm run ([a-z0-9:_-]+)\s+(?:passed|failed)(?:\s+\d+\s*\/\s*\d+)?\b/gi)) {
    if (match[1]) scripts.add(match[1]);
  }
  if (/\bnpm test\s+(passed|failed)\b/i.test(input)) scripts.add("test");
  return scripts;
}

function storedNpmRunScripts(result: OperationExecutionResult): Set<string> {
  const scripts = new Set<string>();
  for (const item of result.evidenceChecked) {
    const match = item.match(/^command-evidence:[^:]+:npm run ([^:]+(?::[^:]+)*):(passed|failed|partial|unknown):/);
    if (match?.[1]) scripts.add(match[1]);
    if (/^command-evidence:[^:]+:npm test:(passed|failed|partial|unknown):/.test(item)) scripts.add("test");
  }
  return scripts;
}

type FailedCommandEvidence = {
  command: string;
  source: "supplied" | "stored";
};

function failedCommandEvidence(plan: OperationPlan, result: OperationExecutionResult): FailedCommandEvidence | undefined {
  const suppliedRun = Array.from(plan.originalInput.matchAll(/\b(npm run [a-z0-9:_-]+|npm test|npx tsx --test\s+.+?)\s+failed\b/gi))
    .map((match) => match[1]?.trim().replace(/\s+/g, " "))
    .filter((command): command is string => Boolean(command))[0];
  if (suppliedRun) {
    return {
      command: suppliedRun,
      source: "supplied"
    };
  }

  for (const item of result.evidenceChecked) {
    const match = item.match(/^command-evidence:[^:]+:(.+):failed:(human_pasted_command_output|codex_reported_command_output|local_stax_command_output)$/);
    if (match?.[1]) {
      return {
        command: match[1],
        source: "stored"
      };
    }
  }
  return undefined;
}

function dependencyRepairBlocker(plan: OperationPlan, result: OperationExecutionResult): string | undefined {
  const haystack = [
    plan.originalInput,
    result.result,
    ...result.risks,
    ...result.evidenceChecked
  ].join("\n");
  if (/@rollup\/rollup-darwin-arm64/i.test(haystack)) return "@rollup/rollup-darwin-arm64 missing";
  if (/\boptional dependency\b/i.test(haystack) && /\brollup\b/i.test(haystack)) return "Rollup optional dependency missing";
  if (/\bCannot find module\b/i.test(haystack) && /\bnode_modules\b/i.test(haystack)) return "node_modules dependency resolution failure";
  return undefined;
}

function dependencyInspectionComplete(plan: OperationPlan, result: OperationExecutionResult): boolean {
  const haystack = [
    plan.originalInput,
    result.result,
    ...result.evidenceChecked
  ].join("\n");
  return /\bnpm ls\s+@rollup\/rollup-darwin-arm64\s+rollup\s+vite\b/i.test(haystack) &&
    /\b(exited\s+0|exit code\s+0|passed)\b/i.test(haystack) &&
    /\b(did not list|not listed|absent|missing|not present)\b/i.test(haystack);
}

function verificationDebtCommand(result: OperationExecutionResult): string | undefined {
  return result.evidenceChecked
    .find((item) => item.startsWith("verification-debt:"))
    ?.match(/^verification-debt:(.+):open$/)?.[1];
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
