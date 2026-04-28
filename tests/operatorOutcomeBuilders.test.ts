import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DirectAnswerBuilder } from "../src/operator/DirectAnswerBuilder.js";
import { NextStepBuilder } from "../src/operator/NextStepBuilder.js";
import {
  dependencyInspectionComplete,
  dependencyRepairBlocker,
  evidenceRequestFor,
  failedCommandEvidence,
  renderedPreviewProofNeed,
  storedCommandEvidenceStatements,
  testCommand
} from "../src/operator/OperatorEvidenceAdapters.js";
import { judgmentPacketFor } from "../src/operator/OperatorJudgmentAdapter.js";
import { visualEvidenceFor, visualNextStep } from "../src/operator/OperatorVisualAdapter.js";
import type { OperationExecutionResult, OperationPlan } from "../src/operator/OperationSchemas.js";

function basePlan(overrides: Partial<OperationPlan> = {}): OperationPlan {
  return {
    operationId: "op_outcome_fixture",
    operatorVersion: "v1B",
    intent: "workspace_repo_audit",
    originalInput: "what tests exist in this repo?",
    workspace: "canvas-helper",
    objective: "Inspect tests without running linked repo commands.",
    operationsToRun: ["RepoEvidencePack.build"],
    riskLevel: "low",
    executionClass: "low_risk_artifact_creating",
    requiresConfirmation: false,
    evidenceRequired: ["repo evidence pack"],
    outputContract: ["receipt"],
    reasonCodes: ["repo_tests_question"],
    confidence: "high",
    ...overrides
  };
}

function baseResult(overrides: Partial<OperationExecutionResult> = {}): OperationExecutionResult {
  return {
    executed: true,
    blocked: false,
    deferred: false,
    actionsRun: ["OperationRiskGate", "RepoEvidencePack.build"],
    artifactsCreated: [],
    evidenceChecked: ["OperationPlan", "repo:package.json", "repo-script:test", "repo-test:tests/index.test.ts"],
    result: "Read-only repo evidence pack.",
    risks: [],
    nextAllowedActions: ["Run tests explicitly if proof is needed."],
    ...overrides
  };
}

describe("DirectAnswerBuilder", () => {
  const builder = new DirectAnswerBuilder();

  it("answers test/script inspection without upgrading static evidence into runtime proof", () => {
    const answer = builder.build(basePlan(), baseResult());

    expect(answer).toContain("STAX found");
    expect(answer).toContain("read-only inspection");
    expect(answer).toContain("pass/fail is unknown");
    expect(answer).not.toContain("tests pass");
  });

  it("prioritizes failed command evidence over generic repo-test language", () => {
    const answer = builder.build(
      basePlan({
        originalInput: "Audit this Codex report. Codex says all tests pass.",
        intent: "codex_report_audit",
        reasonCodes: ["codex_report_audit_intent"]
      }),
      baseResult({
        evidenceChecked: [
          "OperationPlan",
          "RepoPath: /tmp/brightspacequizexporter",
          "repo:package.json",
          "repo-script:test",
          "command-evidence:cmd-1:npm run ingest:ci:failed:human_pasted_command_output"
        ]
      })
    );

    expect(answer).toContain("`npm run ingest:ci` failed");
    expect(answer).toContain("all tests pass");
    expect(answer).toContain("unsupported");
    expect(answer).not.toContain("No executable proof command was run");
  });

  it("keeps rendered-preview claims unverified without visual evidence", () => {
    const answer = builder.build(
      basePlan({
        originalInput: "Sports Wellness rendered preview has text fit, border symmetry, and SMART goals checkmark containment issues.",
        reasonCodes: ["workspace_operating_state_question"]
      }),
      baseResult()
    );

    expect(answer).toContain("rendered-preview uncertainty");
    expect(answer).toContain("VisualEvidenceProtocol: missing");
    expect(answer).toContain("SMART goals checkmark containment");
  });

  it("turns judgment digest output into an approval-required packet summary without acting", () => {
    const answer = builder.build(
      basePlan({
        intent: "judgment_digest",
        reasonCodes: ["human_judgment"]
      }),
      baseResult({
        result: "human_review: 2\nhard_block: 1\nbatch_review: 3",
        evidenceChecked: ["OperationPlan", "review-ledger:local"]
      })
    );

    expect(answer).toContain("JudgmentPacket");
    expect(answer).toContain("requiresHumanApproval=true");
    expect(answer).toContain("recommendedOption=refresh review inbox");
    expect(answer).toContain("No review item was refreshed");
  });
});

describe("NextStepBuilder", () => {
  const builder = new NextStepBuilder();

  it("asks for the one unrun test command when static tests are found", () => {
    const step = builder.build(basePlan(), baseResult());
    const why = builder.why(basePlan(), baseResult());

    expect(step).toContain("Run `npm test`");
    expect(step).toContain("paste back the full output");
    expect(why).toContain("only command output");
  });

  it("keeps failed commands ahead of generic test commands", () => {
    const step = builder.build(
      basePlan({
        originalInput: "npm run ingest:ci failed with Cannot find module @rollup/rollup-darwin-arm64.",
        reasonCodes: ["workspace_risk_question"]
      }),
      baseResult({
        evidenceChecked: [
          "OperationPlan",
          "RepoPath: /tmp/brightspacequizexporter",
          "repo:package.json",
          "repo-script:test",
          "repo-script:ingest:ci"
        ]
      })
    );

    expect(step).toContain("npm ls @rollup/rollup-darwin-arm64 rollup vite");
    expect(step).not.toContain("npm test");
  });

  it("moves completed dependency inspection to a human approval boundary", () => {
    const plan = basePlan({
      originalInput: [
        "npm run ingest:ci failed with Cannot find module @rollup/rollup-darwin-arm64.",
        "npm ls @rollup/rollup-darwin-arm64 rollup vite exited 0 and did not list @rollup/rollup-darwin-arm64."
      ].join(" "),
      reasonCodes: ["workspace_risk_question"]
    });
    const result = baseResult({
      evidenceChecked: [
        "OperationPlan",
        "RepoPath: /tmp/brightspacequizexporter",
        "repo:package.json",
        "repo-script:test",
        "repo-script:ingest:ci"
      ]
    });

    const step = builder.build(plan, result);
    const why = builder.why(plan, result);

    expect(step).toContain("Ask for human approval");
    expect(step).toContain("repair the missing Rollup optional dependency");
    expect(step).toContain("paste back the approval decision");
    expect(why).toContain("human approval boundary");
  });

  it("asks for visual artifacts instead of runtime commands for rendered-preview claims", () => {
    const step = builder.build(
      basePlan({
        originalInput: "Sports Wellness rendered preview text fit and SMART goals checkmark containment still need proof.",
        reasonCodes: ["workspace_operating_state_question"]
      }),
      baseResult()
    );

    expect(step).toContain("Capture the rendered Sports Wellness preview evidence");
    expect(step).toContain("screenshot or visual finding");
    expect(step).not.toContain("npm test");
  });

  it("falls back to a precise evidence request for low-evidence tasks", () => {
    const step = builder.build(
      basePlan({
        originalInput: "Why is deployment failing?",
        intent: "unknown",
        reasonCodes: []
      }),
      baseResult({
        evidenceChecked: ["OperationPlan"],
        result: "No local deployment evidence.",
        risks: [],
        nextAllowedActions: []
      })
    );

    expect(step).toContain("build output");
    expect(step).toContain("deploy output");
    expect(step).toContain("paste");
  });
});

describe("operator evidence, visual, and judgment adapters", () => {
  it("extracts supplied and stored failed command evidence deterministically", () => {
    expect(failedCommandEvidence(
      basePlan({ originalInput: "npm run build failed with a Rollup error." }),
      baseResult()
    )).toEqual({ command: "npm run build", source: "supplied" });

    expect(failedCommandEvidence(
      basePlan(),
      baseResult({ evidenceChecked: ["command-evidence:cmd-1:npm run ingest:ci:failed:local_stax_command_output"] })
    )).toEqual({ command: "npm run ingest:ci", source: "stored" });
  });

  it("detects dependency repair blockers and completed inspections without proposing repair", () => {
    const plan = basePlan({
      originalInput: [
        "Cannot find module @rollup/rollup-darwin-arm64.",
        "npm ls @rollup/rollup-darwin-arm64 rollup vite exited 0 and did not list @rollup/rollup-darwin-arm64."
      ].join(" ")
    });
    const result = baseResult();

    expect(dependencyRepairBlocker(plan, result)).toBe("@rollup/rollup-darwin-arm64 missing");
    expect(dependencyInspectionComplete(plan, result)).toBe(true);
  });

  it("keeps visual proof scoped to visual artifacts and named checks", () => {
    const plan = basePlan({ originalInput: "Sports Wellness rendered preview needs text fit and checkmark containment proof." });
    const visual = visualEvidenceFor(plan);

    expect(renderedPreviewProofNeed(plan)).toBe(true);
    expect(visual.status).toBe("missing");
    expect(visual.unverifiedClaims).toContain("text fit");
    expect(visual.unverifiedClaims).toContain("SMART goals checkmark containment");
    expect(visualNextStep(plan)).toContain("screenshot or visual finding");
  });

  it("builds judgment packets as recommendations rather than actions", () => {
    const packet = judgmentPacketFor(
      basePlan({ intent: "judgment_digest", reasonCodes: ["human_judgment"] }),
      baseResult({
        result: "human_review: 2\nhard_block: 1\nbatch_review: 3",
        evidenceChecked: ["OperationPlan", "review-ledger:local"]
      })
    );

    expect(packet.requiresHumanApproval).toBe(true);
    expect(packet.recommendedOption).toBe("refresh review inbox");
    expect(packet.riskIfApproved).toContain("explicit human-directed operation");
  });

  it("selects proof commands without repeating already supplied command evidence", () => {
    const result = baseResult({
      evidenceChecked: [
        "repo-script:test",
        "repo-script:typecheck",
        "command-evidence:cmd-1:npm run typecheck:passed:human_pasted_command_output"
      ]
    });

    expect(storedCommandEvidenceStatements(result)).toEqual(["npm run typecheck passed"]);
    expect(testCommand(result, "npm run typecheck passed")).toBe("npm test");
  });

  it("keeps low-evidence requests small and task-specific", () => {
    const request = evidenceRequestFor(
      basePlan({ originalInput: "Review this Codex final report for a patch." }),
      baseResult({ evidenceChecked: ["OperationPlan"], result: "" })
    );

    expect(request.requestKind).toBe("codex_report");
    expect(request.minimumEvidenceNeeded).toContain("diff summary");
    expect(request.canProceedWithoutEvidence).toBe(false);
  });
});

describe("operator outcome no-duplicate-branching audit", () => {
  it("keeps shared proof-boundary branches in adapters rather than duplicated builder logic", () => {
    const directSource = fs.readFileSync(path.join(process.cwd(), "src/operator/DirectAnswerBuilder.ts"), "utf8");
    const nextStepSource = fs.readFileSync(path.join(process.cwd(), "src/operator/NextStepBuilder.ts"), "utf8");
    const evidenceSource = fs.readFileSync(path.join(process.cwd(), "src/operator/OperatorEvidenceAdapters.ts"), "utf8");

    for (const shared of [
      "failedCommandEvidence",
      "dependencyRepairBlocker",
      "dependencyInspectionComplete",
      "renderedPreviewProofNeed"
    ]) {
      expect(directSource).toContain(shared);
      expect(nextStepSource).toContain(shared);
      expect(evidenceSource).toContain(`function ${shared}`);
    }

    expect(directSource).not.toContain("new VisualEvidenceProtocol");
    expect(nextStepSource).not.toContain("new VisualEvidenceProtocol");
    expect(directSource).not.toContain("new EvidenceRequestBuilder");
    expect(nextStepSource).not.toContain("new EvidenceRequestBuilder");
    expect(directSource).not.toContain("new JudgmentPacketBuilder");
    expect(nextStepSource).not.toContain("new JudgmentPacketBuilder");
  });
});
