import { describe, expect, it } from "vitest";
import { formatOperatingDashboard, summarizeOperatingDashboard } from "../src/campaign/OperatingDashboard.js";

describe("Operating dashboard", () => {
  it("builds a healthy dashboard from passing campaign summaries", async () => {
    const summary = await summarizeOperatingDashboard({
      baselineLedger: {
        campaignId: "baseline",
        tasks: Array.from({ length: 5 }, (_, index) => ({
          taskId: `baseline_${index + 1}`,
          repo: "STAX",
          cleanupPromptsAfterCodex: 5
        }))
      },
      dogfoodLedger: {
        campaignId: "round_c",
        tasks: Array.from({ length: 10 }, (_, index) => ({
          taskId: `dogfood_${index + 1}`,
          repo: index % 2 === 0 ? "STAX" : "ADMISSION-APP",
          task: "Audit task",
          staxInitialPrompt: "prompt",
          staxInitialPromptUseful: true,
          codexReport: "report",
          staxAudit: "audit",
          fakeCompleteCaught: index < 3,
          missingProofCaught: true,
          wrongRepoPrevented: false,
          cleanupPromptsAfterCodex: 2,
          finalOutcome: "verified_next_state",
          staxCriticalMiss: false,
          humanDecision: "accepted",
          evalCandidate: true
        }))
      },
      failureLedger: {
        campaignId: "failures",
        entries: [
          {
            failureId: "fail_001",
            sourceTaskId: "real_codex_001",
            failureType: "wrong_repo_lane",
            severity: "major",
            expectedBehavior: "bounded",
            actualBehavior: "generic",
            patchTarget: "tests/example.json",
            evalCandidate: true,
            status: "eval_created"
          }
        ]
      },
      closedLoopLedger: {
        campaignId: "closed_loop",
        tasks: Array.from({ length: 20 }, (_, index) => {
          const cleanFailure = index === 19;
          return {
            taskId: `closed_${index + 1}`,
            repo: ["STAX", "ADMISSION-APP", "canvas-helper", "brightspacequizexporter"][index % 4]!,
            state: cleanFailure ? "clean_failure" : "verified_next_state",
            stateHistory: [
              { state: "created", note: "created" },
              { state: "scoped", note: "scoped" },
              { state: "prompt_generated", note: "prompt" },
              { state: "codex_report_received", note: "report" },
              { state: "diff_collected", note: "diff" },
              { state: "command_evidence_collected", note: "command" },
              { state: "audited", note: "audit" },
              { state: cleanFailure ? "clean_failure" : "verified_next_state", note: "done" }
            ],
            objective: "objective",
            staxInitialAudit: "audit",
            staxCodexPrompt: "prompt",
            codexReport: "report",
            diffEvidence: "diff",
            commandEvidence: "command",
            staxPostCodexAudit: "post",
            ...(cleanFailure ? { nextAction: "Collect the missing proof.", failurePatterns: ["A1"], evalCandidates: ["eval_a1_closed_20"] } : {}),
            cleanupPromptsAfterCodex: 0,
            finalOutcome: cleanFailure ? "clean_failure" : "verified_next_state",
            falseAccept: false,
            falseBlock: false,
            usefulBlock: index < 8,
            verifiedAccept: index < 6,
            staxInitialPromptUseful: true,
            evalCandidate: cleanFailure
          };
        })
      },
      humanJudgmentLedger: {
        campaignId: "judgment",
        sourceLedger: "fixtures/real_use/closed_loop_20_tasks.json",
        entries: Array.from({ length: 20 }, (_, index) => ({
          judgmentId: `judgment_${index + 1}`,
          sourceTaskId: `closed_${index + 1}`,
          repo: ["STAX", "ADMISSION-APP", "canvas-helper", "brightspacequizexporter"][index % 4]!,
          humanDecision: index === 19 ? "needs_followup" : "accepted",
          reason: index === 19 ? "Needs followup." : "Useful next action.",
          cleanupPromptsObserved: 0,
          usefulNextAction: true,
          missingProofCaught: index < 8,
          blockedUnnecessarily: false,
          evalCandidate: index < 9,
          promotedLesson: true,
          promotionTarget: index < 9 ? `eval:closed_${index + 1}` : `judgment_note:closed_${index + 1}`,
          ...(index === 19 ? { disagreementNote: "Failure path needs a patch." } : {})
        }))
      },
      operatingWindowLedger: {
        campaignId: "window",
        tasks: Array.from({ length: 30 }, (_, index) => ({
          taskId: `window_${index + 1}`,
          repo: ["STAX", "ADMISSION-APP", "canvas-helper"][index % 3]!,
          cleanupPromptsAfterCodex: 2,
          staxInitialPromptUseful: true,
          humanDecision: "accepted",
          fakeCompleteCaught: index < 10,
          missingProofCaught: true,
          wrongRepoPrevented: false,
          staxCriticalMiss: false,
          evalCandidate: true
        }))
      },
      workflowContractSummary: {
        campaignId: "workflow_contract",
        taskCount: 10,
        promptStrongCount: 8,
        promptUsableCount: 10,
        promptUsableRate: 100,
        reportWellFormedCount: 8,
        reportUsableCount: 10,
        reportUsableRate: 100,
        nextActionCoverage: 100,
        verifiedOutcomeReportCoverage: 100,
        falseAccepts: 0,
        falseBlocks: 0,
        taskSummaries: [],
        status: "workflow_contract_passed",
        blockers: []
      },
      ciFailureTriageSummary: {
        caseCount: 10,
        passingCount: 10,
        likelyCauseAccuracyPct: 100,
        proofStrengthAccuracyPct: 100,
        nextActionAccuracyPct: 100,
        status: "passed",
        issues: []
      },
      prReviewCommentSummary: {
        caseCount: 10,
        passingCount: 10,
        usefulCommentRate: 100,
        status: "passed",
        issues: []
      },
      snapshotDate: "2026-05-03"
    });

    expect(summary.status).toBe("ops_healthy");
    expect(summary.metrics.operatingWindowCleanupReductionPct).toBe(60);
    expect(summary.metrics.closedLoopFalseAccepts).toBe(0);
    expect(summary.metrics.workflowPromptUsableRate).toBe(100);
    expect(summary.failureHotspots[0]?.failureType).toBe("wrong_repo_lane");
    expect(formatOperatingDashboard(summary)).toContain("STAX Ops Dashboard");
    expect(formatOperatingDashboard(summary)).toContain("snapshot: 2026-05-03");
    expect(formatOperatingDashboard(summary)).toContain("workflow contract: workflow_contract_passed");
    expect(formatOperatingDashboard(summary)).toContain("ci failure triage: passed");
    expect(formatOperatingDashboard(summary)).toContain("pr review comment: passed");
    expect(formatOperatingDashboard(summary)).toContain("ci failure triage cases / passing: 10/10 (100%)");
    expect(formatOperatingDashboard(summary)).toContain("pr review comment cases / passing: 10/10 (100%)");
  });
});
