# NEXT PHASES EXECUTION PLAN

Date: 2026-04-30  
Status: historical (plan completed; kept for provenance)  
Scope rule: no new architecture expansion.

Current source of truth:
- `docs/STAX_9_5_PROMOTION_REPORT.md`
- `docs/RAX_REAL_USE_CAMPAIGN_REPORT.md`
- `docs/releases/STAX_Project-Control_9_5_RC1/`

## Purpose

Define the next phase after STAX Core MVP Lock and provider-backed project-control work.  
This plan is now historical: the repo completed the usage-proof and hardening
lane and reached the scoped `STAX Project-Control 9.5 RC1` checkpoint.

## Constraints

Do not add:
- new architecture lanes
- domain adapters
- UI layers
- recommendation features

## Phase A — Comparison Integrity

### Goal
Make every STAX-vs-ChatGPT benchmark run reproducible, timestamped, and evidence-clean.

### Requirements
- One canonical score file per run:
  - `fixtures/real_use/phase11_subscription_capture.json`
- One generated report per run:
  - `runs/real_use_campaign/<date>/phase11_subscription_comparison_<timestamp>.json|md`
- No stale/alternate score files treated as current.
- Every captured STAX and ChatGPT output validated before scoring.
- Reject captured outputs that contain operational capture text instead of task answers.
- Record:
  - `runId`
  - `executedAt`
  - case IDs
  - scorer version
  - rubric version
  - source model/provider context
- Report generation must use the canonical score file only.

### Implemented checks
- `scripts/runPhase11SubscriptionComparison.ts` now blocks non-canonical score file usage.
- `src/campaign/Phase11CaptureIntegrity.ts` validates capture rows.
- `scripts/validatePhase11CaptureIntegrity.ts` provides explicit preflight validation.
- `tests/phase11CaptureIntegrity.test.ts` covers corrupted capture and missing-section failures.
- `src/campaign/ComparisonIntegrity.ts` validates run-folder integrity:
  - required files
  - capture corruption patterns
  - required section presence
  - conflicting/stale score files
  - report summary vs canonical score summary
- `scripts/campaignIntegrity.ts` exposes `npm run campaign:integrity -- --run <runId>` and `--run=<runId>`.
- `tests/comparisonIntegrity.test.ts` covers clean pass + required failure modes.

### Artifacts (run-scoped)
- `fixtures/real_use/runs/<run-id>/cases.json`
- `fixtures/real_use/runs/<run-id>/captures.json`
- `fixtures/real_use/runs/<run-id>/scores.json`
- `fixtures/real_use/runs/<run-id>/report.md`
- `fixtures/real_use/runs/<run-id>/manifest.json`

Current subscription comparison implementation remains at:
- `fixtures/real_use/phase11_subscription_capture.json`
- `runs/real_use_campaign/<date>/phase11_subscription_comparison_<timestamp>.md`

## Phase B — Stateful Advantage Round

### Goal
Test STAX’s true advantage: local state/evidence continuity.

### Protocol
- STAX may use:
  - local workspace state
  - command evidence
  - prior run traces
  - previous audit outputs
  - approved memory
- Raw ChatGPT receives only the current pasted case.
- Case mix must include:
  - repo-targeting traps
  - fake-complete claims
  - weak-proof claims
  - prior-run proof interpretation
  - command-evidence interpretation
  - Codex cleanup tasks

### Acceptance
- 10–20 cases
- 0 STAX critical misses
- no corrupted captures
- STAX wins or ties while showing lower cleanup burden
- every STAX miss becomes eval/patch candidate

### Current run
- `fixtures/real_use/runs/phaseB-stateful-20-2026-04-30`
- Integrity command: `npm run campaign:integrity -- --run phaseB-stateful-20-2026-04-30`
- Integrity status: passed
- Canonical comparison summary: 20 cases, 0 STAX wins, 0 ChatGPT wins, 20 ties, 0 STAX critical misses, 0 ChatGPT critical misses.
- Executable rerun summary:
  - `npm run campaign:phaseB:refresh -- --run phaseB-stateful-20-2026-04-30`
  - `npm run campaign:phaseB:score -- --run phaseB-stateful-20-2026-04-30`
  - `fixtures/real_use/runs/phaseB-stateful-20-2026-04-30/executable_benchmark_summary.json`
  - 7 STAX wins, 0 ChatGPT wins, 13 ties.
- Interpretation: safe no-loss stateful comparison with a promising executable rerun, but still not decisive superiority or a 9+ claim.

## Phase C — Cleanup Burden KPI

### Goal
Track whether STAX reduces Dean’s real Codex cleanup burden.

### Definition
`cleanup_prompts_after_codex` = number of additional prompts required after Codex’s first response before reaching verified completion, clean failure, or bounded stop.

### Track per real task
- `taskId`
- `repo`
- `firstStaxPrompt`
- `codexReport`
- `staxAudit`
- `cleanupPromptsAfterCodex`
- `fakeCompleteCaught`
- `missingProofCaught`
- `wrongRepoPrevented`
- `finalOutcome`
- `evalCandidate`

### Target
- 10 real tasks
- 0 STAX critical misses
- at least 3 meaningful catches across 10 tasks
- cleanup burden trends downward versus baseline

### Implemented check
- `src/campaign/BaselineCleanup.ts`
- `scripts/baselineCleanup.ts`
- `npm run campaign:baseline`
- `src/campaign/RealUseCampaignIntegrity.ts`
- `scripts/realUseCampaignIntegrity.ts`
- `npm run campaign:real-use:integrity`
- `src/campaign/RealUseReplayGate.ts`
- `scripts/realUseReplayGate.ts`
- `npm run campaign:real-use:replay`
- `src/campaign/DogfoodRoundC.ts`
- `scripts/dogfoodRoundC.ts`
- `npm run campaign:dogfood:c`
- `src/campaign/FailureLedger.ts`
- `scripts/failureLedger.ts`
- `npm run campaign:failures`
- `src/campaign/OperatingWindow.ts`
- `scripts/operatingWindow.ts`
- `npm run campaign:operating-window`
- `src/campaign/PromotionGate95.ts`
- `scripts/promotionGate95.ts`
- `npm run campaign:promotion-gate`

### Current ledger result
- Ledger: `fixtures/real_use/dogfood_10_tasks_2026-04-30.json`
- Status: `promotion_blocked`
- 10 tasks recorded
- 0 STAX critical misses
- 10 meaningful catches
- 7 cleanup prompts after Codex
- 3/10 useful initial STAX prompts
- 8/10 accepted human decisions

Interpretation: the real-use loop has strong safety/catch signal, but it does
not yet prove cleanup reduction or a 9+ promotion gate.

Current replay result:
- `npm run campaign:real-use:replay`: passed
- 10/10 historical dogfood tasks now hit the expected current proof lane.

Interpretation: current behavior has repaired the observed first-prompt routing
misses, but this does not rewrite the historical cleanup ledger.

Current new-gate results:
- `npm run campaign:baseline`: `baseline_incomplete`
- `npm run campaign:failures`: `tracked`
- `npm run campaign:dogfood:c`: `invalid` (fresh round not yet recorded)
- `npm run campaign:operating-window`: `invalid` (30-task window not yet recorded)
- `npm run campaign:promotion-gate`: `promotion_blocked`

## Phase D — Promotion Gate

### Goal
Define when repeated STAX behavior becomes eval/regression coverage or approved workflow rule.

### Promotion threshold
- 3 consecutive clean runs OR 10 real workflow tasks
- 0 STAX critical misses
- no corrupted benchmark data
- pattern appears at least twice
- human decision recorded
- weak proof is not treated as hard proof
- every promotion links to source cases and command/judgment evidence

### Stop conditions
- any STAX critical miss
- any corrupted capture row
- any conflicting score file
- any hard proof claim backed only by weak evidence
- STAX increases cleanup burden for 3 consecutive tasks

## Commands

Implemented now:
- `npm run campaign:phase11:prepare`
- `npm run campaign:phase11:next`
- `npm run campaign:phase11:capture`
- `npm run campaign:phase11:integrity`
- `npm run campaign:phase11:subscription`
- `npm run campaign:integrity -- --run investor-proof-10-2026-05-01`
- `npm run campaign:baseline`
- `npm run campaign:real-use:integrity`
- `npm run campaign:real-use:replay`
- `npm run campaign:dogfood:c`
- `npm run campaign:failures`
- `npm run campaign:operating-window`
- `npm run campaign:promotion-gate`

Implemented run-scoped comparison folders:
- `fixtures/real_use/runs/<run-id>/...`

## Allowed Claims vs Not Allowed Claims

Allowed:
- STAX is ready for usage-proof testing.
- STAX has benchmark scaffolding.
- STAX has shown safety/no-loss signals in early runs when artifacts support it.
- STAX has a 10-task real-use ledger with strong safety/catch signal but blocked promotion.

Not allowed:
- STAX beats ChatGPT generally.
- STAX is production-ready.
- STAX is 9+.
- STAX reduces cleanup burden until 10 real tasks prove it.
- STAX has proven decisive superiority from Phase B; Phase B is tie-heavy.

## What This Patch Implements vs Documents

Implemented:
- canonical phase11 score-file enforcement
- capture-integrity validator
- capture-integrity CLI preflight command
- integrity tests
- run-folder integrity command and validator
- Phase B stateful run integrity check
- executable Phase B STAX refresh/scoring loop
- Phase C real-use campaign ledger integrity check
- Phase C real-use replay gate for current first-prompt routing
- baseline cleanup ledger gate
- failure ledger gate
- fresh dogfood Round C gate
- operating-window gate
- 9.5 promotion gate

Documented only (next execution slices):
- fresh measured baseline cleanup counts
- fresh Round C task evidence
- 30-task operating window evidence
- promotion to 9.5 after clean repeated real-use runs

## Next One Bounded Action

Run:

```bash
npm run campaign:baseline
npm run campaign:failures
npm run campaign:dogfood:c
npm run campaign:promotion-gate
```

Then fill the missing evidence instead of broadening architecture: measure five baseline tasks, record ten fresh Round C tasks, and only then re-evaluate the promotion gate.
