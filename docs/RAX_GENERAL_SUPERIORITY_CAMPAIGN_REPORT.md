# RAX General Superiority Campaign Report

Date: 2026-04-27

## Why This Exists

The repo had a strong local problem benchmark, but the user correctly pushed
back that local repo superiority is not the same as broad usefulness or general
superiority. This slice adds a higher-level campaign gate above the existing
benchmark.

## Files Created

- `src/superiority/GeneralSuperioritySchemas.ts`
- `src/superiority/GeneralSuperiorityGate.ts`
- `tests/generalSuperiorityGate.test.ts`
- `docs/STAX_GENERAL_SUPERIORITY_CAMPAIGN.md`
- `docs/RAX_GENERAL_SUPERIORITY_CAMPAIGN_REPORT.md`

## Files Modified

- `src/cli.ts`
- `src/compare/ProblemBenchmarkSchemas.ts`
- `src/learning/LearningMetrics.ts`

## Commands Added

```bash
npm run rax -- superiority status
npm run rax -- superiority score
npm run rax -- superiority failures
npm run rax -- superiority prompt
```

## Current Campaign Status

Current benchmark fixtures score as:

```txt
Status: not_proven
Comparisons: 90/250
BlindComparisons: 25/250
WorkLanes: 5/12
TaskFamilies: 64/12
ReposOrDomains: 8/7
ExternalSources: 3/2
CaptureDates: 1/3
ExternalBetter: 0
Ties: 6
NoLocalBasis: 0
NoExternalBaseline: 0
ExpectedMismatches: 6
```

This is the honest result. STAX is not yet generally superior because:

- six ties remain from the fresh holdout
- only 25 comparisons are locked-before-external blind cases
- broad work-lane coverage is too narrow
- external baselines are from one capture date

## What Changed

The local benchmark still answers the narrow question:

```txt
Did STAX beat the external answer on this fixture slice?
```

The General Superiority Gate asks the broader question:

```txt
Has STAX beaten external baselines across enough blind comparisons, work lanes, domains, sources, and dates to make a broader superiority claim?
```

## Validation Hardening

During the full test suite, parallel eval tests exposed a metrics-cache race:
one process could read `learning/metrics/learning_metrics.json` while another
process was writing it. `LearningMetricsStore` now treats empty/partial JSON
cache reads as a cache miss and writes metrics through a temp file plus rename.
This prevents a transient cache artifact from failing unrelated tests.

## Validation

```txt
npm run typecheck: passed
npm test: passed; 50 files / 234 tests
npm run rax -- eval: passed; 16/16
npm run rax -- eval --regression: passed; 43/43
npm run rax -- eval --redteam: passed; 9/9
npm run rax -- superiority status: passed; Status not_proven
npm run rax -- superiority failures: passed; listed six tie cases
npm run rax -- superiority prompt: passed
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes.": passed
```

## Limitations

- This does not capture new external ChatGPT answers automatically.
- This does not prove literal superiority over every possible task.
- The gate is deterministic and should be challenged with fresh tasks.
- Existing `external_better` or `tie` cases must become candidates, not silent fixture edits.
