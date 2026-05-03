# Command Proof (STAX_Project-Control_9_5_RC4)

- Recorded at: 2026-05-03T22:16:13.891Z
- Root dir: `/Users/deanguedo/Documents/GitHub/STAX`
- Status: `passed`

## Summary
- typecheck: exit 0 (expected 0) :: `npm run typecheck`
- test: exit 0 (expected 0) :: `npm test`
- validate_all: exit 0 (expected 0) :: `npm run validate:all`
- promotion_gate: exit 0 (expected 0) :: `npm run campaign:promotion-gate`
- pr_artifact_integrity: exit 0 (expected 0) :: `npm run pr-artifact:integrity`
- pr_artifact_score: exit 0 (expected 0) :: `npm run pr-artifact:score`
- pr_artifact_live_trial: exit 0 (expected 0) :: `npm run pr-artifact:live-trial`
- ci_failure_score: exit 0 (expected 0) :: `npm run ci-failure:score`
- pr_review_comment_score: exit 0 (expected 0) :: `npm run pr-review-comment:score`
- repo_onboarding_score: exit 0 (expected 0) :: `npm run repo-onboarding:score`
- overblock_campaign: exit 0 (expected 0) :: `npm run campaign:overblock`
- closed_loop_campaign: exit 0 (expected 0) :: `npm run campaign:closed-loop`
- closed_loop_workflow: exit 0 (expected 0) :: `npm run campaign:closed-loop:workflow`
- ops_dashboard: exit 0 (expected 0) :: `npm run stax:ops-dashboard`

## Command Logs
### typecheck

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm run typecheck`
- Exit code: 0
- Expected exit code: 0
- Started at: 2026-05-03T22:14:56.618Z
- Finished at: 2026-05-03T22:15:00.541Z

Stdout tail:

```text
> rax@0.1.0 typecheck
> tsc --noEmit
```

Stderr tail:

```text
(empty)
```

### test

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm test`
- Exit code: 0
- Expected exit code: 0
- Started at: 2026-05-03T22:15:00.541Z
- Finished at: 2026-05-03T22:15:16.448Z

Stdout tail:

```text
> rax@0.1.0 test
> vitest run


 RUN  v4.1.5 /Users/deanguedo/Documents/GitHub/STAX


 Test Files  157 passed (157)
      Tests  768 passed (768)
   Start at  16:15:01
   Duration  15.35s (transform 10.00s, setup 0ms, import 44.53s, tests 59.37s, environment 34ms)
```

Stderr tail:

```text
(empty)
```

### validate_all

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm run validate:all`
- Exit code: 0
- Expected exit code: 0
- Started at: 2026-05-03T22:15:16.448Z
- Finished at: 2026-05-03T22:15:37.923Z

Stdout tail:

```text
> rax@0.1.0 validate:all
> npm run typecheck && npm run test && npm run audit:doctrine && npm run audit:boundaries && npm run audit:security


> rax@0.1.0 typecheck
> tsc --noEmit


> rax@0.1.0 test
> vitest run


 RUN  v4.1.5 /Users/deanguedo/Documents/GitHub/STAX


 Test Files  157 passed (157)
      Tests  768 passed (768)
   Start at  16:15:21
   Duration  15.41s (transform 10.44s, setup 0ms, import 43.07s, tests 59.69s, environment 38ms)


> rax@0.1.0 audit:doctrine
> tsx scripts/auditDoctrine.ts

Doctrine audit passed.

> rax@0.1.0 audit:boundaries
> tsx scripts/auditBoundaries.ts

Boundary audit passed.

> rax@0.1.0 audit:security
> tsx scripts/auditSecurity.ts

Security audit passed.
```

Stderr tail:

```text
(empty)
```

### promotion_gate

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm run campaign:promotion-gate`
- Exit code: 0
- Expected exit code: 0
- Started at: 2026-05-03T22:15:37.923Z
- Finished at: 2026-05-03T22:15:38.530Z

Stdout tail:

```text
> rax@0.1.0 campaign:promotion-gate
> tsx scripts/promotionGate95.ts

{
  "cleanRunsPassed": 3,
  "requiredCleanRuns": 3,
  "baselineStatus": "baseline_ready",
  "dogfoodRoundCStatus": "round_c_passed",
  "failureLedgerStatus": "tracked",
  "workflowContractStatus": "workflow_contract_passed",
  "humanJudgmentStatus": "judgment_ready",
  "operatingWindowStatus": "operating_window_passed",
  "ciFailureTriageStatus": "passed",
  "prReviewCommentStatus": "passed",
  "status": "promotion_ready",
  "blockers": []
}
```

Stderr tail:

```text
(empty)
```

### pr_artifact_integrity

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm run pr-artifact:integrity`
- Exit code: 0
- Expected exit code: 0
- Started at: 2026-05-03T22:15:38.530Z
- Finished at: 2026-05-03T22:15:39.358Z

Stdout tail:

```text
> rax@0.1.0 pr-artifact:integrity
> tsx scripts/prArtifactTrialIntegrity.ts

{
  "fixtureSet": "real_pr_artifact_trial_v1",
  "snapshotCount": 10,
  "caseCount": 50,
  "categoryCounts": {
    "passing_ci": 10,
    "failing_ci": 10,
    "docs_config_only": 10,
    "tests_fixtures_goldens": 10,
    "ui_data_deploy_security": 10
  },
  "snapshotCoverageValid": true,
  "caseShapeValid": true,
  "status": "passed",
  "issues": []
}
```

Stderr tail:

```text
(empty)
```

### pr_artifact_score

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm run pr-artifact:score`
- Exit code: 0
- Expected exit code: 0
- Started at: 2026-05-03T22:15:39.358Z
- Finished at: 2026-05-03T22:15:40.683Z

Stdout tail:

```text
> rax@0.1.0 pr-artifact:score
> tsx scripts/prArtifactTrialScore.ts

{
  "fixtureSet": "real_pr_artifact_trial_v1",
  "snapshotCount": 10,
  "caseCount": 50,
  "falseAccepts": 0,
  "falseBlocks": 0,
  "falseBlockRatePct": 0,
  "usefulNextActions": 50,
  "usefulNextActionRate": 100,
  "ciProofClassificationAccuracy": 100,
  "criticalMisses": 0,
  "evalCandidatesCreated": 0,
  "misses": [],
  "status": "passed",
  "blockers": []
}
```

Stderr tail:

```text
(empty)
```

### pr_artifact_live_trial

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm run pr-artifact:live-trial`
- Exit code: 0
- Expected exit code: 0
- Started at: 2026-05-03T22:15:40.683Z
- Finished at: 2026-05-03T22:16:09.272Z

Stdout tail:

```text
> rax@0.1.0 pr-artifact:live-trial
> tsx scripts/prArtifactLiveTrial.ts --limit 25 --min-live 5

{
  "fixtureSet": "real_pr_artifact_trial_v1",
  "selectedCaseCount": 25,
  "requestedCaseCount": 25,
  "liveSourceCount": 25,
  "fallbackSourceCount": 0,
  "falseAccepts": 0,
  "falseBlocks": 0,
  "falseBlockRatePct": 0,
  "usefulNextActionRate": 100,
  "ciProofClassificationSurfaceRate": 100,
  "status": "passed",
  "blockers": [],
  "cases": [
    {
      "caseId": "nextjs_93417_case_01",
      "snapshotId": "nextjs_93417",
      "repoFullName": "vercel/next.js",
      "prNumber": 93417,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "nextjs_93417_case_02",
      "snapshotId": "nextjs_93417",
      "repoFullName": "vercel/next.js",
      "prNumber": 93417,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "nextjs_93417_case_03",
      "snapshotId": "nextjs_93417",
      "repoFullName": "vercel/next.js",
      "prNumber": 93417,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "nextjs_93417_case_04",
      "snapshotId": "nextjs_93417",
      "repoFullName": "vercel/next.js",
      "prNumber": 93417,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "nextjs_93417_case_05",
      "snapshotId": "nextjs_93417",
      "repoFullName": "vercel/next.js",
      "prNumber": 93417,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "storybook_34681_case_01",
      "snapshotId": "storybook_34681",
      "repoFullName": "storybookjs/storybook",
      "prNumber": 34681,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "storybook_34681_case_02",
      "snapshotId": "storybook_34681",
      "repoFullName": "storybookjs/storybook",
      "prNumber": 34681,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "storybook_34681_case_03",
      "snapshotId": "storybook_34681",
      "repoFullName": "storybookjs/storybook",
      "prNumber": 34681,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "storybook_34681_case_04",
      "snapshotId": "storybook_34681",
      "repoFullName": "storybookjs/storybook",
      "prNumber": 34681,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "storybook_34681_case_05",
      "snapshotId": "storybook_34681",
      "repoFullName": "storybookjs/storybook",
      "prNumber": 34681,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "vitest_10231_case_01",
      "snapshotId": "vitest_10231",
      "repoFullName": "vitest-dev/vitest",
      "prNumber": 10231,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "vitest_10231_case_02",
      "snapshotId": "vitest_10231",
      "repoFullName": "vitest-dev/vitest",
      "prNumber": 10231,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "vitest_10231_case_03",
      "snapshotId": "vitest_10231",
      "repoFullName": "vitest-dev/vitest",
      "prNumber": 10231,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "vitest_10231_case_04",
      "snapshotId": "vitest_10231",
      "repoFullName": "vitest-dev/vitest",
      "prNumber": 10231,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "vitest_10231_case_05",
      "snapshotId": "vitest_10231",
      "repoFullName": "vitest-dev/vitest",
      "prNumber": 10231,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "nextjs_93410_case_01",
      "snapshotId": "nextjs_93410",
      "repoFullName": "vercel/next.js",
      "prNumber": 93410,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "nextjs_93410_case_02",
      "snapshotId": "nextjs_93410",
      "repoFullName": "vercel/next.js",
      "prNumber": 93410,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "nextjs_93410_case_03",
      "snapshotId": "nextjs_93410",
      "repoFullName": "vercel/next.js",
      "prNumber": 93410,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "nextjs_93410_case_04",
      "snapshotId": "nextjs_93410",
      "repoFullName": "vercel/next.js",
      "prNumber": 93410,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "nextjs_93410_case_05",
      "snapshotId": "nextjs_93410",
      "repoFullName": "vercel/next.js",
      "prNumber": 93410,
      "source": "live_github_api",
      "expectedStatus": "Provisional",
      "actualStatus": "Provisional",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "nextjs_93400_case_01",
      "snapshotId": "nextjs_93400",
      "repoFullName": "vercel/next.js",
      "prNumber": 93400,
      "source": "live_github_api",
      "expectedStatus": "Accept",
      "actualStatus": "Accept",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "nextjs_93400_case_02",
      "snapshotId": "nextjs_93400",
      "repoFullName": "vercel/next.js",
      "prNumber": 93400,
      "source": "live_github_api",
      "expectedStatus": "Accept",
      "actualStatus": "Accept",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "nextjs_93400_case_03",
      "snapshotId": "nextjs_93400",
      "repoFullName": "vercel/next.js",
      "prNumber": 93400,
      "source": "live_github_api",
      "expectedStatus": "Accept",
      "actualStatus": "Accept",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "nextjs_93400_case_04",
      "snapshotId": "nextjs_93400",
      "repoFullName": "vercel/next.js",
      "prNumber": 93400,
      "source": "live_github_api",
      "expectedStatus": "Accept",
      "actualStatus": "Accept",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    },
    {
      "caseId": "nextjs_93400_case_05",
      "snapshotId": "nextjs_93400",
      "repoFullName": "vercel/next.js",
      "prNumber": 93400,
      "source": "live_github_api",
      "expectedStatus": "Accept",
      "actualStatus": "Accept",
      "usefulNextAction": true,
      "ciProofSurfaced": true,
      "falseAccept": false,
      "falseBlock": false,
      "warnings": [],
      "issues": []
    }
  ]
}
```

Stderr tail:

```text
(empty)
```

### ci_failure_score

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm run ci-failure:score`
- Exit code: 0
- Expected exit code: 0
- Started at: 2026-05-03T22:16:09.272Z
- Finished at: 2026-05-03T22:16:09.794Z

Stdout tail:

```text
> rax@0.1.0 ci-failure:score
> tsx scripts/ciFailureTriageScore.ts

{
  "caseCount": 24,
  "passingCount": 24,
  "likelyCauseAccuracyPct": 100,
  "proofStrengthAccuracyPct": 100,
  "nextActionAccuracyPct": 100,
  "status": "passed",
  "issues": []
}
```

Stderr tail:

```text
(empty)
```

### pr_review_comment_score

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm run pr-review-comment:score`
- Exit code: 0
- Expected exit code: 0
- Started at: 2026-05-03T22:16:09.794Z
- Finished at: 2026-05-03T22:16:10.315Z

Stdout tail:

```text
> rax@0.1.0 pr-review-comment:score
> tsx scripts/prReviewCommentScore.ts

{
  "caseCount": 15,
  "passedCount": 15,
  "usefulCommentRate": 100,
  "status": "passed",
  "issues": []
}
```

Stderr tail:

```text
(empty)
```

### repo_onboarding_score

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm run repo-onboarding:score`
- Exit code: 0
- Expected exit code: 0
- Started at: 2026-05-03T22:16:10.315Z
- Finished at: 2026-05-03T22:16:10.824Z

Stdout tail:

```text
> rax@0.1.0 repo-onboarding:score
> tsx scripts/repoOnboardingScore.ts

{
  "caseCount": 26,
  "packageManagerChecks": 14,
  "packageManagerHits": 14,
  "archetypeChecks": 22,
  "archetypeHits": 22,
  "visualChecks": 14,
  "visualHits": 14,
  "proofGateChecks": 14,
  "proofGateHits": 14,
  "dangerousActionChecks": 8,
  "dangerousActionHits": 8,
  "status": "passed",
  "issues": []
}
```

Stderr tail:

```text
(empty)
```

### overblock_campaign

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm run campaign:overblock`
- Exit code: 0
- Expected exit code: 0
- Started at: 2026-05-03T22:16:10.825Z
- Finished at: 2026-05-03T22:16:12.493Z

Stdout tail:

```text
> rax@0.1.0 campaign:overblock
> tsx scripts/overblockCalibration.ts

{
  "taskCount": 100,
  "sufficientProofCases": 50,
  "insufficientProofCases": 50,
  "verifiedAccepts": 50,
  "falseAccepts": 0,
  "falseRejects": 0,
  "falseRejectRatePct": 0,
  "provisionalCount": 5,
  "humanReviewCount": 0,
  "cleanFailureCount": 0,
  "status": "calibration_passed",
  "blockerReasons": []
}
```

Stderr tail:

```text
(empty)
```

### closed_loop_campaign

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm run campaign:closed-loop`
- Exit code: 0
- Expected exit code: 0
- Started at: 2026-05-03T22:16:12.493Z
- Finished at: 2026-05-03T22:16:12.945Z

Stdout tail:

```text
> rax@0.1.0 campaign:closed-loop
> tsx scripts/closedLoopCodexCampaign.ts

{
  "ledgerPath": "fixtures/real_use/closed_loop_20_tasks.json",
  "baselineLedgerPath": "fixtures/real_use/baseline_cleanup_tasks.json",
  "campaignId": "closed_loop_20_tasks",
  "taskCount": 20,
  "reposRepresented": 4,
  "stateCoverageValid": true,
  "evidenceReplayValid": true,
  "evidenceReplayDeterministic": true,
  "evidenceReplayChainValid": true,
  "evidenceReplayIssues": [],
  "auditTraceCount": 20,
  "doctrineVersion": "core-v1",
  "runtimeVersion": "0.1.0",
  "failureRoutingValid": true,
  "autoRoutedFailureCount": 3,
  "failureRoutingIssues": [],
  "evalGenerationValid": true,
  "generatedEvalCandidateCount": 1,
  "evalGenerationIssues": [],
  "falseAccepts": 0,
  "falseBlocks": 0,
  "usefulBlocks": 12,
  "verifiedAccepts": 11,
  "usefulInitialPrompts": 20,
  "usefulInitialPromptRate": 100,
  "verifiedNextStateRate": 80,
  "cleanupPromptsMean": 0,
  "baselineMeanCleanupPrompts": 1.4,
  "cleanupReductionPct": 100,
  "evalConversionRate": 100,
  "status": "closed_loop_passed",
  "blockers": []
}
```

Stderr tail:

```text
(empty)
```

### closed_loop_workflow

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm run campaign:closed-loop:workflow`
- Exit code: 0
- Expected exit code: 0
- Started at: 2026-05-03T22:16:12.945Z
- Finished at: 2026-05-03T22:16:13.346Z

Stdout tail:

```text
> rax@0.1.0 campaign:closed-loop:workflow
> tsx scripts/liveCodexWorkflowContract.ts

{
  "campaignId": "live_codex_workflow_v1",
  "taskCount": 10,
  "promptStrongCount": 10,
  "promptUsableCount": 10,
  "promptUsableRate": 100,
  "reportWellFormedCount": 9,
  "reportUsableCount": 10,
  "reportUsableRate": 100,
  "nextActionCoverage": 100,
  "verifiedOutcomeReportCoverage": 100,
  "falseAccepts": 0,
  "falseBlocks": 0,
  "taskSummaries": [
    {
      "taskId": "workflow_001",
      "promptStatus": "strong",
      "reportStatus": "well_formed",
      "nextActionPresent": true,
      "verifiedOutcome": true,
      "issues": []
    },
    {
      "taskId": "workflow_002",
      "promptStatus": "strong",
      "reportStatus": "well_formed",
      "nextActionPresent": true,
      "verifiedOutcome": false,
      "issues": []
    },
    {
      "taskId": "workflow_003",
      "promptStatus": "strong",
      "reportStatus": "well_formed",
      "nextActionPresent": true,
      "verifiedOutcome": false,
      "issues": []
    },
    {
      "taskId": "workflow_004",
      "promptStatus": "strong",
      "reportStatus": "well_formed",
      "nextActionPresent": true,
      "verifiedOutcome": true,
      "issues": []
    },
    {
      "taskId": "workflow_005",
      "promptStatus": "strong",
      "reportStatus": "well_formed",
      "nextActionPresent": true,
      "verifiedOutcome": false,
      "issues": []
    },
    {
      "taskId": "workflow_006",
      "promptStatus": "strong",
      "reportStatus": "well_formed",
      "nextActionPresent": true,
      "verifiedOutcome": true,
      "issues": []
    },
    {
      "taskId": "workflow_007",
      "promptStatus": "strong",
      "reportStatus": "well_formed",
      "nextActionPresent": true,
      "verifiedOutcome": true,
      "issues": []
    },
    {
      "taskId": "workflow_008",
      "promptStatus": "strong",
      "reportStatus": "partial",
      "nextActionPresent": true,
      "verifiedOutcome": false,
      "issues": [
        "report contract: pass claims mention no command-output details"
      ]
    },
    {
      "taskId": "workflow_009",
      "promptStatus": "strong",
      "reportStatus": "well_formed",
      "nextActionPresent": true,
      "verifiedOutcome": false,
      "issues": []
    },
    {
      "taskId": "workflow_010",
      "promptStatus": "strong",
      "reportStatus": "well_formed",
      "nextActionPresent": true,
      "verifiedOutcome": true,
      "issues": []
    }
  ],
  "status": "workflow_contract_passed",
  "blockers": []
}
```

Stderr tail:

```text
(empty)
```

### ops_dashboard

- CWD: `/Users/deanguedo/Documents/GitHub/STAX`
- Command: `npm run stax:ops-dashboard`
- Exit code: 0
- Expected exit code: 0
- Started at: 2026-05-03T22:16:13.346Z
- Finished at: 2026-05-03T22:16:13.891Z

Stdout tail:

```text
> rax@0.1.0 stax:ops-dashboard
> tsx scripts/opsDashboard.ts

STAX Ops Dashboard
- snapshot: 2026-05-03
- status: ops_healthy

Status Checks
- baseline: baseline_ready
- dogfood round c: round_c_passed
- closed loop: closed_loop_passed
- workflow contract: workflow_contract_passed
- human judgment: judgment_ready
- failure ledger: tracked
- operating window: operating_window_passed
- ci failure triage: passed
- pr review comment: passed

Key Metrics
- baseline mean cleanup prompts: 1.4
- dogfood cleanup reduction: 100%
- closed-loop verified next-state rate: 80%
- closed-loop false accepts / false blocks: 0/0
- workflow prompt usable rate: 100%
- workflow report usable rate: 100%
- operating-window cleanup reduction: 100%
- operating-window accepted decisions: 100%
- operating-window useful initial prompts: 100%
- operating-window meaningful catches: 21
- ci failure triage cases / passing: 24/24 (100%)
- pr review comment cases / passing: 15/15 (100%)
- human-judgment followups / blocked-too-hard: 0/0
- eval candidates: 9

Trendlines
- Cleanup reduction moved from baseline to Dogfood Round C: 100%.
- Useful prompt rate from Dogfood Round C to Operating Window: flat 0.
- Live Codex workflow prompt/report usability: 100%/100%.
- Accepted decision rate from Dogfood Round C to Operating Window: flat 0.
- Closed-loop false accepts / false blocks: 0/0.

Repo Hotspots
- ADMISSION-APP: 3
- brightspacequizexporter: 3
- canvas-helper: 2

Failure Hotspots
- brightspace_context_leak: 1
- cross_repo_context_leak: 1
- repeated_audit_loop: 1

Next Recommended Hardening Task
- Patch the top recurring failure pattern: brightspace_context_leak.

Blockers
- none
```

Stderr tail:

```text
(empty)
```

