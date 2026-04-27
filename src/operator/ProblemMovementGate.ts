import {
  ProblemMovementInputSchema,
  ProblemMovementResultSchema,
  type ProblemMovementDisposition,
  type ProblemMovementInput,
  type ProblemMovementResult
} from "./ProblemMovementSchemas.js";

export class ProblemMovementGate {
  evaluate(rawInput: ProblemMovementInput): ProblemMovementResult {
    const parsed = ProblemMovementInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return invalidResult("Unknown task", parsed.error.issues.map((issue) => issue.message), "");
    }

    const input = parsed.data;
    const blockingReasons: string[] = [];
    const primaryStep = primaryNextStep(input.oneNextStep);
    const foundTestsOrScripts = input.evidenceChecked.some((item) => /^repo-(test|script):/.test(item));
    const suppliedCommandEvidence = hasUserSuppliedCommandEvidence(input);
    const blockedOrDeferred = input.receiptStatus === "blocked" || input.receiptStatus === "deferred" || input.receiptStatus === "not_executed";

    if (!input.directAnswer.trim()) {
      blockingReasons.push("Direct Answer cannot be empty.");
    }
    if (isReceiptOnlyAnswer(input.directAnswer)) {
      blockingReasons.push("Direct Answer only points at process/receipt details and does not answer the user task.");
    }
    if (!input.whyThisStep.trim()) {
      blockingReasons.push("Why This Step cannot be empty.");
    }
    if (!/\b(verified|partial|blocked|deferred)\b/i.test(input.proofStatus)) {
      blockingReasons.push("Proof Status must identify verified, partial, blocked, or deferred proof.");
    }

    const stepIssues = validateNextStep(input.oneNextStep, primaryStep);
    blockingReasons.push(...stepIssues);

    if (blockedOrDeferred) {
      if (!/\b(no action was executed|did not execute|did not modify|did not approve|did not promote)\b/i.test(input.directAnswer)) {
        blockingReasons.push("Blocked or deferred answers must state that no action was executed.");
      }
      if (/\blearn promote\b|--memory|--training|--eval\b/i.test(primaryStep)) {
        blockingReasons.push("Blocked chat answers cannot surface a promotion command as the one next step.");
      }
    }

    if (foundTestsOrScripts) {
      if (!/\b(test|script)s?\b/i.test(input.directAnswer)) {
        blockingReasons.push("Direct Answer must mention tests or scripts when local evidence found them.");
      }
      if (!suppliedCommandEvidence && !/pass\/fail.*unknown|unknown.*pass\/fail/i.test(input.directAnswer)) {
        blockingReasons.push("Direct Answer must say test pass/fail is unknown when tests/scripts were found but not run.");
      }
      if (suppliedCommandEvidence && !/\buser-supplied command evidence\b/i.test(input.directAnswer)) {
        blockingReasons.push("Direct Answer must label pasted command results as user-supplied command evidence.");
      }
      if (!/\bnpm (run|test)\b/i.test(primaryStep)) {
        blockingReasons.push("One Next Step must name the exact test command when tests/scripts were found.");
      }
    }

    if (claimsCompletionWithoutProof(input)) {
      blockingReasons.push("Answer claims completion, fixed behavior, verified behavior, or passing tests without command/eval/trace evidence.");
    }

    if (input.mutationStatus !== "none") {
      blockingReasons.push("Problem Movement Gate does not allow chat operator source mutation in this slice.");
    }
    if (input.promotionStatus !== "not_allowed" && input.promotionStatus !== "blocked") {
      blockingReasons.push("Problem Movement Gate does not allow promotion from chat operator output in this slice.");
    }

    if (blockingReasons.length) {
      return ProblemMovementResultSchema.parse({
        valid: false,
        disposition: "failed_to_move",
        movesProblemForward: false,
        statedProblem: input.userTask,
        movementMade: "No acceptable problem movement was established.",
        remainingRisk: blockingReasons[0],
        requiredEvidence: requiredEvidence(input),
        nextAllowedAction: primaryStep,
        blockingReasons,
        requiredRewrite: requiredRewrite(input, blockingReasons)
      });
    }

    const disposition = dispositionFor(input);
    const movesProblemForward = disposition === "moved_problem" || disposition === "needs_evidence" || disposition === "human_choice_required";
    return ProblemMovementResultSchema.parse({
      valid: true,
      disposition,
      movesProblemForward,
      statedProblem: input.userTask,
      movementMade: movementMade(input, disposition, primaryStep),
      remainingRisk: remainingRisk(input, disposition),
      requiredEvidence: requiredEvidence(input),
      nextAllowedAction: primaryStep,
      blockingReasons: []
    });
  }
}

function validateNextStep(oneNextStep: string, primaryStep: string): string[] {
  const issues: string[] = [];
  const bullets = oneNextStep
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));

  if (bullets.length > 1) {
    issues.push("One Next Step must contain exactly one primary action.");
  }
  if (!primaryStep.trim()) {
    issues.push("One Next Step cannot be empty.");
    return issues;
  }
  if (isGenericNextStep(primaryStep)) {
    issues.push(`One Next Step is too generic to move the problem forward: ${primaryStep}`);
  }
  if (!/^(Run|Use|Paste|Create|Link|Inspect|Open|Ask|Set)\b/i.test(primaryStep)) {
    issues.push("One Next Step must start with a concrete action verb.");
  }
  if (countCommandLikeFragments(primaryStep) > 1) {
    issues.push("One Next Step must not offer multiple command alternatives.");
  }
  if (isManualOrExternalStep(primaryStep) && !/\bpaste back\b/i.test(primaryStep)) {
    issues.push("Manual or external next steps must say what to paste back.");
  }
  return issues;
}

function primaryNextStep(oneNextStep: string): string {
  const bullet = oneNextStep
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("- "));
  return (bullet ?? oneNextStep).replace(/^-\s+/, "").trim();
}

function isReceiptOnlyAnswer(answer: string): boolean {
  const normalized = answer.toLowerCase().replace(/[`"'.,]/g, "").replace(/\s+/g, " ").trim();
  return [
    "see receipt",
    "see the receipt",
    "details below",
    "receipt below",
    "handled",
    "processed"
  ].includes(normalized);
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
    "use the codex prompt or required next proof from the audit",
    "use the audits required next proof or codex prompt as the next task"
  ];
  return generic.some((phrase) => normalized === phrase || normalized.startsWith(`${phrase} `));
}

function isManualOrExternalStep(step: string): boolean {
  return /\b(npm|pnpm|yarn|tsx|vitest|rax|CLI|command|Codex final report)\b/i.test(step);
}

function countCommandLikeFragments(step: string): number {
  const backticked = [...step.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1])
    .filter((fragment) => /\b(npm|pnpm|yarn|tsx|vitest|rax)\b/i.test(fragment)).length;
  const inline = [...step.matchAll(/\b(npm\s+(?:run|test)|pnpm\s+\w+|yarn\s+\w+|tsx\s+\S+|rax\s+\w+)/gi)].length;
  return Math.max(backticked, inline);
}

function claimsCompletionWithoutProof(input: ProblemMovementInput): boolean {
  const text = [
    input.directAnswer,
    ...input.claimsVerified,
    input.proofStatus
  ].join("\n");
  if (!/\b(tests? (pass|passed)|passed tests?|typecheck pass|evals? pass|complete|completed|implemented|fixed|done|solved|verified)\b/i.test(text)) {
    return false;
  }
  if (/\b(no operation action was executed|no source files were modified|did not execute|pass\/fail is unknown|unknown pass\/fail)\b/i.test(text)) {
    return false;
  }
  if (hasUserSuppliedCommandEvidence(input) && /\buser-supplied command evidence\b/i.test(input.directAnswer) && /\bpartial\b/i.test(input.proofStatus)) {
    return false;
  }
  return !hasCommandOrTraceEvidence(input);
}

function hasUserSuppliedCommandEvidence(input: ProblemMovementInput): boolean {
  return /\bnpm run [a-z0-9:_-]+\s+(passed|failed)\b/i.test(input.userTask) ||
    /\bnpm test\s+(passed|failed)\b/i.test(input.userTask) ||
    /\bnpx tsx --test\b[\s\S]*?\bpassed\s+\d+\s*\/\s*\d+/i.test(input.userTask);
}

function hasCommandOrTraceEvidence(input: ProblemMovementInput): boolean {
  return [...input.evidenceChecked, ...input.artifactsCreated, ...input.claimsVerified].some((item) =>
    /^cmd-ev-/.test(item) ||
    /^evidence\/commands\//.test(item) ||
    /^evals\/eval_results\//.test(item) ||
    /^runs\//.test(item) ||
    /\btrace\.json\b/i.test(item) ||
    /\bnpm (run|test)\b.*\b(exit code 0|passed|0 failed)\b/i.test(item)
  );
}

function dispositionFor(input: ProblemMovementInput): ProblemMovementDisposition {
  if (input.receiptStatus === "blocked") return "blocked";
  if (input.receiptStatus === "deferred" || input.receiptStatus === "not_executed") return "deferred";
  if (input.executionClass === "requires_confirmation" || input.riskLevel === "high" || input.riskLevel === "critical") {
    return "human_choice_required";
  }
  if (input.missingEvidence.length || input.proofStatus === "partial") return "needs_evidence";
  return "moved_problem";
}

function movementMade(input: ProblemMovementInput, disposition: ProblemMovementDisposition, primaryStep: string): string {
  if (disposition === "blocked") return "Blocked a risky chat request and gave one safe inspection step.";
  if (disposition === "deferred") return "Deferred execution to an explicit governed command path.";
  if (disposition === "human_choice_required") return "Separated the judgment required from actions STAX can safely take automatically.";
  if (disposition === "needs_evidence") return `Identified the next evidence step: ${primaryStep}`;
  return "Answered the task with sufficient proof for this operator slice.";
}

function remainingRisk(input: ProblemMovementInput, disposition: ProblemMovementDisposition): string {
  if (input.fakeCompleteRisks.length) return input.fakeCompleteRisks[0];
  if (input.missingEvidence.length) return input.missingEvidence[0];
  if (disposition === "blocked") return "User judgment is required before any risky approval or promotion path.";
  if (disposition === "deferred") return "No action has run yet; the explicit command path still needs evidence.";
  return "No additional risk was identified by the problem movement gate.";
}

function requiredEvidence(input: ProblemMovementInput): string[] {
  const evidence = new Set(input.missingEvidence);
  if (input.evidenceChecked.some((item) => /^repo-(test|script):/.test(item))) {
    if (!Array.from(evidence).some((item) => /command output|test\/typecheck|pass or fail/i.test(item))) {
      evidence.add("Command output proving test/typecheck pass or fail.");
    }
  }
  if (!evidence.size && input.evidenceRequired.length) {
    for (const item of input.evidenceRequired) evidence.add(item);
  }
  return Array.from(evidence);
}

function requiredRewrite(input: ProblemMovementInput, blockingReasons: string[]): string {
  const lead = input.evidenceChecked.some((item) => /^repo-(test|script):/.test(item))
    ? "Rewrite with a direct answer that names the found tests/scripts, states pass/fail is unknown, and gives exactly one runnable test command with paste-back instructions."
    : "Rewrite with a direct answer to the user's task, exactly one concrete next action, and explicit proof honesty.";
  return `${lead} Blocking reasons: ${blockingReasons.join("; ")}`;
}

function invalidResult(task: string, blockingReasons: string[], nextAllowedAction: string): ProblemMovementResult {
  return ProblemMovementResultSchema.parse({
    valid: false,
    disposition: "failed_to_move",
    movesProblemForward: false,
    statedProblem: task,
    movementMade: "Problem movement input was invalid.",
    remainingRisk: blockingReasons[0] ?? "Invalid problem movement input.",
    requiredEvidence: [],
    nextAllowedAction,
    blockingReasons,
    requiredRewrite: `Provide a valid ProblemMovementInput. Blocking reasons: ${blockingReasons.join("; ")}`
  });
}
