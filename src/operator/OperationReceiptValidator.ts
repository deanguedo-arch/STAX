import { missingHeadings, sectionContent } from "../validators/markdownSections.js";
import { OperationReceiptSchema, type OperationReceipt } from "./OperationReceipt.js";

export type OperationReceiptValidation = {
  valid: boolean;
  issues: string[];
};

const requiredReceiptHeadings = [
  "## Direct Answer",
  "## One Next Step",
  "## Why This Step",
  "## Proof Status",
  "## Receipt",
  "## Operation",
  "## Evidence Required",
  "## Evidence Checked",
  "## Artifacts Created",
  "## Claims Verified",
  "## Claims Not Verified",
  "## Missing Evidence",
  "## Fake-Complete Risks",
  "## Next Allowed Action"
];

export class OperationReceiptValidator {
  validate(receipt: OperationReceipt): OperationReceiptValidation {
    const parsed = OperationReceiptSchema.safeParse(receipt);
    const issues = parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
    const foundTestsOrScripts = receipt.evidenceChecked.some((item) => /^repo-(test|script):/.test(item));
    const hasCommandEvidence = receipt.evidenceChecked.some((item) =>
      /^cmd-ev-/.test(item) ||
      /^evidence\/commands\//.test(item) ||
      /^evals\/eval_results\//.test(item) ||
      /\bnpm (run|test)\b.*\b(exit code 0|passed|0 failed)\b/i.test(item)
    );

    for (const claim of receipt.claimsVerified) {
      if (claim.evidenceRefs.length === 0) {
        issues.push(`Verified claim lacks evidence: ${claim.claim}`);
      }
      for (const evidenceRef of claim.evidenceRefs) {
        if (isVagueEvidenceRef(evidenceRef)) {
          issues.push(`Verified claim uses vague evidence reference: ${evidenceRef}`);
        }
      }
      if (isCompletionClaim(claim.claim) && !hasCommandEvidence && !isNoActionClaim(claim.claim)) {
        issues.push(`Completion-like verified claim lacks command/eval evidence: ${claim.claim}`);
      }
    }

    if (foundTestsOrScripts && !receipt.claimsNotVerified.some((claim) => /pass\/fail.*unknown|unknown.*pass\/fail/i.test(claim))) {
      issues.push("Receipts that find tests or scripts must state tests were not run and pass/fail is unknown.");
    }

    if (foundTestsOrScripts && !receipt.fakeCompleteRisks.some((risk) => /does not prove tests pass|test scripts.*not prove/i.test(risk))) {
      issues.push("Receipts that find tests or scripts must include a fake-complete risk about tests not being proven.");
    }

    if (foundTestsOrScripts && !receipt.missingEvidence.some((item) => /command output|test\/typecheck|pass or fail/i.test(item))) {
      issues.push("Receipts that find tests or scripts must list missing command evidence.");
    }

    if (receipt.mutationStatus !== "none") {
      issues.push("Chat Operator receipts must not report source mutation in this slice.");
    }

    if (receipt.promotionStatus !== "not_allowed" && receipt.promotionStatus !== "blocked") {
      issues.push("Chat Operator receipts must not allow promotion in this slice.");
    }

    if ((receipt.status === "blocked" || receipt.status === "deferred") && receipt.actionsRun.some((action) => action !== "OperationRiskGate")) {
      issues.push("Blocked/deferred receipts cannot list operation actions as run.");
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  validateMarkdown(output: string): OperationReceiptValidation {
    const issues = missingHeadings(output, requiredReceiptHeadings).map((heading) => `Missing receipt heading: ${heading}`);
    const directAnswer = sectionContent(output, "## Direct Answer");
    const oneNextStep = sectionContent(output, "## One Next Step");
    const whyThisStep = sectionContent(output, "## Why This Step");
    const proofStatus = sectionContent(output, "## Proof Status");
    const verified = sectionContent(output, "## Claims Verified");
    const notVerified = sectionContent(output, "## Claims Not Verified");
    const fakeRisks = sectionContent(output, "## Fake-Complete Risks");
    const missingEvidence = sectionContent(output, "## Missing Evidence");
    const usesUserSuppliedCommandEvidence = /\buser-supplied command evidence\b/i.test(directAnswer);
    const directAnswerIndex = output.indexOf("## Direct Answer");
    const receiptIndex = output.indexOf("## Receipt");
    if (directAnswerIndex === -1 || receiptIndex === -1 || receiptIndex < directAnswerIndex) {
      issues.push("Outcome header must appear before the receipt.");
    }
    if (!directAnswer.trim()) {
      issues.push("Direct Answer cannot be empty.");
    }
    if (!whyThisStep.trim()) {
      issues.push("Why This Step cannot be empty.");
    }
    if (!/\b(verified|partial|blocked|deferred)\b/i.test(proofStatus)) {
      issues.push("Proof Status must be verified, partial, blocked, or deferred.");
    }
    const nextSteps = oneNextStep
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "));
    if (nextSteps.length !== 1) {
      issues.push("One Next Step must contain exactly one primary bullet.");
    }
    const primaryStep = nextSteps[0]?.replace(/^-\s+/, "").trim() ?? oneNextStep.trim();
    if (!primaryStep) {
      issues.push("One Next Step cannot be empty.");
    }
    if (isGenericNextStep(primaryStep)) {
      issues.push(`One Next Step is too generic: ${primaryStep}`);
    }
    if (!/^(Run|Use|Paste|Create|Link|Inspect|Open|Ask|Set)\b/i.test(primaryStep)) {
      issues.push("One Next Step must start with a concrete action verb.");
    }
    if (isManualOrExternalStep(primaryStep) && !/\bpaste back\b/i.test(primaryStep)) {
      issues.push("Manual or external next steps must say what to paste back.");
    }
    if (/\b(Status:\s+blocked|Status:\s+deferred|ExecutionClass:\s+(hard_block|review_only|requires_confirmation))\b/i.test(output) && !/\bno action was executed|did not execute\b/i.test(directAnswer)) {
      issues.push("Blocked or deferred responses must state in Direct Answer that no action was executed.");
    }
    if (/\btests? (pass|passed)|completion|complete|implemented|fixed\b/i.test(verified) && !/\bevidence:\s*(cmd-ev-|evidence\/commands\/|evals\/eval_results\/)/i.test(verified)) {
      issues.push("Markdown receipt has a completion-like verified claim without command/eval evidence.");
    }
    if (/\brepo-(test|script):/i.test(output) && !/pass\/fail.*unknown|unknown.*pass\/fail/i.test(notVerified)) {
      issues.push("Markdown receipt found tests/scripts but did not say pass/fail is unknown.");
    }
    if (/\brepo-(test|script):/i.test(output) && !usesUserSuppliedCommandEvidence && !/pass\/fail.*unknown|unknown.*pass\/fail/i.test(directAnswer)) {
      issues.push("Direct Answer must state test pass/fail is unknown when tests/scripts were found but not run.");
    }
    if (/\brepo-(test|script):/i.test(output) && !/does not prove tests pass|test scripts.*not prove/i.test(fakeRisks)) {
      issues.push("Markdown receipt found tests/scripts but omitted fake-complete risk.");
    }
    if (/\brepo-(test|script):/i.test(output) && !/command output|test\/typecheck|pass or fail/i.test(missingEvidence)) {
      issues.push("Markdown receipt found tests/scripts but omitted missing command evidence.");
    }
    if (!/\bMutationStatus:\s+none\b/i.test(output)) {
      issues.push("Markdown receipt must state MutationStatus: none.");
    }
    if (!/\bPromotionStatus:\s+(not_allowed|blocked)\b/i.test(output)) {
      issues.push("Markdown receipt must state promotions are not allowed or blocked.");
    }
    return {
      valid: issues.length === 0,
      issues
    };
  }
}

function isVagueEvidenceRef(evidenceRef: string): boolean {
  return /^(repo evidence pack|local evidence|evidence|proof|repo files|test files|scripts)$/i.test(evidenceRef.trim());
}

function isCompletionClaim(claim: string): boolean {
  return /\b(tests? pass|passed tests?|typecheck pass|evals? pass|complete|completed|implemented|fixed|done|solved)\b/i.test(claim);
}

function isNoActionClaim(claim: string): boolean {
  return /\b(no operation action was executed|no source files were modified)\b/i.test(claim);
}

function isGenericNextStep(step: string): boolean {
  const normalized = step.toLowerCase().replace(/[`"'.,]/g, "").replace(/\s+/g, " ").trim();
  const generic = [
    "review the evidence",
    "continue analysis",
    "improve the repo",
    "check the tests",
    "investigate further",
    "follow up",
    "make it better",
    "review tests",
    "check evidence",
    "use the codex prompt or required next proof from the audit"
  ];
  return generic.some((phrase) => normalized === phrase || normalized.startsWith(`${phrase} `));
}

function isManualOrExternalStep(step: string): boolean {
  return /\b(npm|pnpm|yarn|tsx|vitest|rax|CLI|command|Codex final report)\b/i.test(step);
}
