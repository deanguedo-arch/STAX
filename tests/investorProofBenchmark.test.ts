import { describe, expect, it } from "vitest";
import {
  buildInvestorBenchmarkCollection,
  buildCanonicalInvestorScores,
  formatCanonicalInvestorReport,
  type InvestorCaptureEntry
} from "../src/campaign/InvestorProofBenchmark.js";
import type { ProblemBenchmarkSummary } from "../src/compare/ProblemBenchmarkSchemas.js";

describe("InvestorProofBenchmark", () => {
  it("builds a benchmark collection with repo-aware local evidence", () => {
    const captures: InvestorCaptureEntry[] = [
      {
        taskId: "investor_brightspace_ingest_005",
        workspace: "brightspacequizexporter",
        category: "build_ingest_gate",
        prompt: "After dependency presence is proven in Brightspace, what exact gate command proves build plus ingest without using seed-gold?",
        staxOutput: "## Verdict\n- bounded",
        chatgptOutput: "## Verdict\n- generic"
      }
    ];

    const collection = buildInvestorBenchmarkCollection(captures);
    expect(collection.id).toBe("investor-proof-10");
    expect(collection.cases).toHaveLength(1);
    expect(collection.cases[0]?.repo).toBe("brightspacequizexporter");
    expect(collection.cases[0]?.localEvidence).toContain("repo-script:build=npm run build");
    expect(collection.cases[0]?.localEvidence).toContain("repo-script:ingestGate=npm run ingest:ci");
  });

  it("builds canonical investor scores from benchmark summary results", () => {
    const summary: ProblemBenchmarkSummary = {
      total: 2,
      staxBetter: 1,
      externalBetter: 0,
      ties: 1,
      noLocalBasis: 0,
      noExternalBaseline: 0,
      expectedMismatches: 0,
      confidence: "promising",
      superiorityStatus: "not_proven",
      superiorityGaps: [],
      proofIntegrityGaps: [],
      holdoutFreshnessGaps: [],
      continueLoopRequired: true,
      stopConditionMet: false,
      results: [
        {
          caseId: "case_001",
          repo: "ADMISSION-APP",
          winner: "stax_better",
          staxScore: {
            actualAnswer: 1,
            localSpecificity: 1,
            commandSpecificity: 1,
            boundedNextAction: 1,
            proofHonesty: 1,
            codexReadiness: 1,
            riskControl: 1,
            total: 88
          },
          externalScore: {
            actualAnswer: 1,
            localSpecificity: 0.5,
            commandSpecificity: 0,
            boundedNextAction: 0.1,
            proofHonesty: 1,
            codexReadiness: 0.5,
            riskControl: 0.15,
            total: 52
          },
          staxAnswerSource: "local_stax_cli_stateful",
          externalAnswerSource: "raw_chatgpt_iab",
          reasons: [],
          missingLocalEvidence: [],
          externalBaselineGaps: [],
          suggestedEval: "keep",
          suggestedPromptPatch: "none",
          proofIntegrity: {
            allowed: true,
            claimLevel: "trained_slice_pass",
            firstPassEligible: false,
            superiorityEligible: false,
            reasons: [],
            requiredLabel: "trained_slice_pass"
          }
        },
        {
          caseId: "case_002",
          repo: "STAX",
          winner: "tie",
          staxScore: {
            actualAnswer: 1,
            localSpecificity: 0.5,
            commandSpecificity: 0,
            boundedNextAction: 0.1,
            proofHonesty: 1,
            codexReadiness: 0.5,
            riskControl: 0.15,
            total: 52
          },
          externalScore: {
            actualAnswer: 1,
            localSpecificity: 0.52,
            commandSpecificity: 0,
            boundedNextAction: 0.1,
            proofHonesty: 1,
            codexReadiness: 0.5,
            riskControl: 0.15,
            total: 53
          },
          staxAnswerSource: "local_stax_cli_stateful",
          externalAnswerSource: "raw_chatgpt_iab",
          reasons: [],
          missingLocalEvidence: [],
          externalBaselineGaps: [],
          suggestedEval: "keep",
          suggestedPromptPatch: "none",
          proofIntegrity: {
            allowed: true,
            claimLevel: "trained_slice_pass",
            firstPassEligible: false,
            superiorityEligible: false,
            reasons: [],
            requiredLabel: "trained_slice_pass"
          }
        }
      ]
    };

    const scores = buildCanonicalInvestorScores(summary);
    expect(scores).toEqual([
      expect.objectContaining({
        taskId: "case_001",
        staxScore: 88,
        chatgptScore: 52,
        staxCriticalMiss: false,
        chatgptCriticalMiss: false,
        winner: "stax"
      }),
      expect.objectContaining({
        taskId: "case_002",
        staxScore: 52,
        chatgptScore: 53,
        winner: "tie"
      })
    ]);
  });

  it("formats a canonical investor report with scored status", () => {
    const report = formatCanonicalInvestorReport({
      runId: "investor-proof-test",
      status: "integrity_checked",
      summary: {
        total: 10,
        staxBetter: 7,
        externalBetter: 0,
        ties: 3,
        noLocalBasis: 0,
        noExternalBaseline: 0,
        expectedMismatches: 0,
        confidence: "promising",
        superiorityStatus: "not_proven",
        superiorityGaps: [],
        proofIntegrityGaps: [],
        holdoutFreshnessGaps: [],
        continueLoopRequired: true,
        stopConditionMet: false,
        results: []
      }
    });

    expect(report).toContain("- STAX wins: 7");
    expect(report).toContain("- ChatGPT wins: 0");
    expect(report).toContain("- Ties: 3");
    expect(report).toContain("- integrity_checked");
    expect(report).not.toContain("capture_required");
  });
});
