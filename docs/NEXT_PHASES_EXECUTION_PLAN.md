# NEXT PHASES EXECUTION PLAN

Date: 2026-04-30  
Status: active (usage-proof + hardening)  
Scope rule: no new architecture expansion.

## Purpose

Define the next phase after STAX Core MVP Lock and provider-backed project-control work.  
The next phase is usage-proof and hardening, not architecture expansion.

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
- `scripts/campaignIntegrity.ts` exposes `npm run campaign:integrity -- --run <runId>`.
- `tests/comparisonIntegrity.test.ts` covers clean pass + required failure modes.

### Artifacts (run-scoped)
- `fixtures/real_use/<run-id>/cases.json` (proposed)
- `fixtures/real_use/<run-id>/captures.json` (proposed)
- `fixtures/real_use/<run-id>/scores.json` (proposed)
- `docs/reports/<run-id>.md` (proposed)

Current canonical implementation remains at:
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
- `npm run campaign:integrity -- --run sample-clean-run`

Proposed (not implemented in this patch):
- per-run isolated fixture folders under `fixtures/real_use/<run-id>/...`

## Allowed Claims vs Not Allowed Claims

Allowed:
- STAX is ready for usage-proof testing.
- STAX has benchmark scaffolding.
- STAX has shown safety/no-loss signals in early runs when artifacts support it.

Not allowed:
- STAX beats ChatGPT generally.
- STAX is production-ready.
- STAX is 9+.
- STAX reduces cleanup burden until 10 real tasks prove it.

## What This Patch Implements vs Documents

Implemented:
- canonical phase11 score-file enforcement
- capture-integrity validator
- capture-integrity CLI preflight command
- integrity tests
- run-folder integrity command and validator

Documented only (next execution slices):
- run-scoped fixture folder migration
- full stateful round dataset expansion
- KPI dashboarding for cleanup burden trendline

## Next One Bounded Action

Run:

```bash
npm run campaign:phase11:integrity
npm run campaign:phase11:subscription
```

Then record the resulting run IDs in the real-use campaign report and promote only zero-miss patterns.
