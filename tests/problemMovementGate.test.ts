import { describe, expect, it } from "vitest";
import { ProblemMovementGate } from "../src/operator/ProblemMovementGate.js";
import type { ProblemMovementInput } from "../src/operator/ProblemMovementSchemas.js";

function baseInput(overrides: Partial<ProblemMovementInput> = {}): ProblemMovementInput {
  return {
    userTask: "what tests exist in this repo?",
    intent: "workspace_repo_audit",
    reasonCodes: ["repo_tests_question"],
    riskLevel: "low",
    executionClass: "low_risk_artifact_creating",
    directAnswer: "STAX found test/script evidence by read-only inspection, but it did not run tests; pass/fail is unknown.",
    oneNextStep: "Run `npm test` in the target repo and paste back the full output, exit code if available, and failing test names if any.",
    whyThisStep: "Only command output can prove whether the tests pass or fail.",
    proofStatus: "partial",
    receiptStatus: "executed",
    evidenceRequired: ["repo evidence pack"],
    evidenceChecked: ["OperationPlan", "repo:package.json", "repo-script:test", "repo-test:tests/index.test.ts"],
    artifactsCreated: [],
    claimsVerified: ["package.json scripts were extracted read-only.", "Test files were enumerated read-only."],
    claimsNotVerified: ["Tests were found, but no test command was executed by this operator; pass/fail is unknown."],
    missingEvidence: ["Local command output for test/typecheck pass or fail."],
    fakeCompleteRisks: ["Finding test scripts or test files does not prove tests pass."],
    nextAllowedActions: ["Run tests explicitly if proof is needed."],
    mutationStatus: "none",
    promotionStatus: "not_allowed",
    ...overrides
  };
}

describe("ProblemMovementGate", () => {
  it("accepts a concrete operator answer that names tests and asks for one proof command", () => {
    const result = new ProblemMovementGate().evaluate(baseInput());

    expect(result.valid).toBe(true);
    expect(result.disposition).toBe("needs_evidence");
    expect(result.movesProblemForward).toBe(true);
    expect(result.nextAllowedAction).toContain("npm test");
  });

  it("rejects a polished but receipt-only answer", () => {
    const result = new ProblemMovementGate().evaluate(baseInput({
      directAnswer: "See the receipt"
    }));

    expect(result.valid).toBe(false);
    expect(result.blockingReasons.join(" ")).toContain("process/receipt");
  });

  it("rejects vague next steps that dump work back on the user", () => {
    const result = new ProblemMovementGate().evaluate(baseInput({
      oneNextStep: "Review the evidence"
    }));

    expect(result.valid).toBe(false);
    expect(result.blockingReasons.join(" ")).toContain("too generic");
  });

  it("rejects multiple primary next steps", () => {
    const result = new ProblemMovementGate().evaluate(baseInput({
      oneNextStep: "- Run `npm test` and paste back the output.\n- Run `npm run typecheck` and paste back the output."
    }));

    expect(result.valid).toBe(false);
    expect(result.blockingReasons.join(" ")).toContain("exactly one primary action");
  });

  it("rejects command alternatives in one next step", () => {
    const result = new ProblemMovementGate().evaluate(baseInput({
      oneNextStep: "Run `npm test` or `npm run typecheck` and paste back the output."
    }));

    expect(result.valid).toBe(false);
    expect(result.blockingReasons.join(" ")).toContain("multiple command alternatives");
  });

  it("rejects test evidence that is ignored by the direct answer", () => {
    const result = new ProblemMovementGate().evaluate(baseInput({
      directAnswer: "STAX inspected the repo and produced a useful receipt."
    }));

    expect(result.valid).toBe(false);
    expect(result.blockingReasons.join(" ")).toContain("pass/fail is unknown");
  });

  it("accepts bounded user-supplied command evidence without upgrading it to full repo proof", () => {
    const result = new ProblemMovementGate().evaluate(baseInput({
      userTask: "audit canvas-helper after this command evidence: npm run typecheck passed; npx tsx --test scripts/tests/foo.test.ts passed 1/1; npm run build:studio passed.",
      directAnswer: "User-supplied command evidence says npm run typecheck passed; npx tsx --test scripts/tests/foo.test.ts passed 1/1; npm run build:studio passed. STAX also found test/script evidence by read-only inspection. Treat this as partial proof for the named commands only; it does not prove full repo behavior or approve any mutation.",
      oneNextStep: "Run `npm run test:course-shell` in the target repo and paste back the full output, exit code if available, and failing test names if any."
    }));

    expect(result.valid).toBe(true);
    expect(result.disposition).toBe("needs_evidence");
    expect(result.movesProblemForward).toBe(true);
  });

  it("rejects completion claims without command or eval evidence", () => {
    const result = new ProblemMovementGate().evaluate(baseInput({
      evidenceChecked: ["OperationPlan", "repo:package.json"],
      claimsNotVerified: [],
      missingEvidence: [],
      fakeCompleteRisks: [],
      directAnswer: "STAX verified that the repo is fixed and tests passed.",
      oneNextStep: "Paste the command output if you want a deeper audit."
    }));

    expect(result.valid).toBe(false);
    expect(result.blockingReasons.join(" ")).toContain("without command/eval/trace evidence");
  });

  it("accepts blocked risky requests only when the next step is safe inspection", () => {
    const result = new ProblemMovementGate().evaluate(baseInput({
      userTask: "approve all memory candidates",
      intent: "unknown",
      reasonCodes: ["approval_request_blocked"],
      riskLevel: "critical",
      executionClass: "hard_block",
      directAnswer: "Blocked. STAX did not execute the requested operation, approve anything, promote anything, or mutate durable state.",
      oneNextStep: "Run `npm run rax -- learn queue` to inspect candidates before any approval or promotion path; paste back the output.",
      proofStatus: "blocked",
      receiptStatus: "blocked",
      evidenceChecked: ["OperationRiskGate"],
      claimsVerified: ["No operation action was executed because the risk gate blocked the request."],
      claimsNotVerified: ["The requested operation was not completed or applied."],
      missingEvidence: ["Explicit future command or approval path before execution."],
      fakeCompleteRisks: ["A blocked or deferred receipt proves no action happened; it is not task completion."],
      promotionStatus: "blocked"
    }));

    expect(result.valid).toBe(true);
    expect(result.disposition).toBe("blocked");
    expect(result.movesProblemForward).toBe(false);
  });

  it("rejects blocked answers that surface promotion commands", () => {
    const result = new ProblemMovementGate().evaluate(baseInput({
      userTask: "approve all memory candidates",
      intent: "unknown",
      riskLevel: "critical",
      executionClass: "hard_block",
      directAnswer: "Blocked. STAX did not execute the requested operation or promote anything.",
      oneNextStep: "Run `npm run rax -- learn promote <event-id> --memory --reason \"...\"` and paste back the output.",
      proofStatus: "blocked",
      receiptStatus: "blocked",
      evidenceChecked: ["OperationRiskGate"],
      promotionStatus: "blocked"
    }));

    expect(result.valid).toBe(false);
    expect(result.blockingReasons.join(" ")).toContain("promotion command");
  });

  it("rejects mutation or promotion statuses from chat operator output", () => {
    const mutation = new ProblemMovementGate().evaluate(baseInput({ mutationStatus: "source_modified" }));
    const promotion = new ProblemMovementGate().evaluate(baseInput({ promotionStatus: "approved" }));

    expect(mutation.valid).toBe(false);
    expect(mutation.blockingReasons.join(" ")).toContain("source mutation");
    expect(promotion.valid).toBe(false);
    expect(promotion.blockingReasons.join(" ")).toContain("promotion");
  });
});
