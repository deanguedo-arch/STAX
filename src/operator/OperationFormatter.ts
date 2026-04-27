import type { OperationExecutionResult, OperationPlan } from "./OperationSchemas.js";
import { buildOperationReceipt, renderOperationReceipt, type OperationReceipt } from "./OperationReceipt.js";
import { OperationReceiptValidator } from "./OperationReceiptValidator.js";

export class OperationFormatter {
  format(plan: OperationPlan, result: OperationExecutionResult): string {
    const receipt = buildOperationReceipt(plan, result);
    const validation = new OperationReceiptValidator().validate(receipt);
    if (!validation.valid) {
      throw new Error(`OperationReceipt validation failed: ${validation.issues.join("; ")}`);
    }
    const output = [
      renderOutcomeHeader(plan, result, receipt),
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

function renderOutcomeHeader(plan: OperationPlan, result: OperationExecutionResult, receipt: OperationReceipt): string {
  return [
    "## Direct Answer",
    directAnswer(plan, result),
    "",
    "## One Next Step",
    `- ${oneNextStep(plan, result)}`,
    "",
    "## Why This Step",
    whyThisStep(plan, result),
    "",
    "## Proof Status",
    proofStatus(receipt)
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
    return "Inspect the specific candidate with `npm run rax -- learn queue`, then promote one item only with `npm run rax -- learn promote <event-id> --memory --reason \"...\"` if you truly intend promotion; paste back the command output.";
  }
  if (result.deferred || !result.executed) {
    return ensurePasteBack(result.nextAllowedActions[0]?.trim() || "Use the explicit slash or CLI command for this operation and paste back the output.");
  }
  if (hasTestsOrScripts(result)) {
    return `Run \`${testCommand(result)}\` in ${repoPath(result) ?? "the target repo"} and paste back the full output, exit code if available, and failing test names if any.`;
  }
  if (plan.intent === "judgment_digest") {
    return "Run `/review digest` if you want a dry-run refresh summary, or `npm run rax -- review inbox` to refresh persisted review metadata; paste back the output if you want STAX to interpret it.";
  }
  if (plan.intent === "audit_last_proof") {
    return "Run the exact verification command named in the audit's Required Next Proof section and paste back the command output.";
  }
  if (plan.intent === "audit_workspace" || plan.intent === "workspace_repo_audit") {
    return "Use the audit's Required Next Proof or Codex Prompt as the next task, then paste back the resulting command output or Codex final report.";
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

function repoPath(result: OperationExecutionResult): string | undefined {
  return result.evidenceChecked.find((item) => item.startsWith("RepoPath: "))?.replace("RepoPath: ", "");
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
