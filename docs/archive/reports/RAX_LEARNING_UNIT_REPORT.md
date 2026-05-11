# RAX Learning Unit Report

## Summary

This rollout adds the approved STAX learning loop foundation. STAX is the adaptive rule-aware learning/runtime system; `stax_fitness` remains an explicit optional domain mode.

## Files Created

- `src/learning/*`
- `src/validators/PlanningValidator.ts`
- `src/validators/LearningUnitValidator.ts`
- `src/schemas/LearningUnitOutput.ts`
- `modes/learning_unit.mode.md`
- `prompts/tasks/learning_unit.md`
- `docs/STAX_IDENTITY.md`
- learning regression evals and tests

## Behavior Added

- Runs create `learning_event.json`.
- Traces link `learningEventId` and `learningQueues`.
- Weak/generic planning is detected with specificity scoring.
- Candidate queues and proposals are approval-gated.
- CLI exposes `show` and `learn` commands for chat-readable inspection.
- Promotions require explicit approval metadata.
- Command events now include `commandId`, command name, args summary, success, exit code, and denied/allowed command state.
- Replay drift is classified as `replay_failure` / `replay_drift` and routes to eval/policy candidates.
- Promotion failures are classified as `promotion_failure` and route to correction/eval candidates.
- Retention dry-run preserves runs linked to approved, queued, correction, eval, golden, training, or memory artifacts.

## Limitations

- Policy/schema/mode promotions create proposal artifacts first; direct source patching remains out of scope.
- Retention defaults to dry-run and must be applied explicitly with a reason.
- This is an approved learning loop, not autonomous learning.

## Command Evidence

- `npm run typecheck`: passed.
- `npm test`: passed, 33 test files and 95 tests.
- `npm run rax -- run --mode planning "Ok what i need then is at a base level i need you to ask it how to make this into a learning unit that takes every input and question and process and it gets better and better over time."`: passed, run `run-2026-04-25T15-30-01-125Z-vzmjm2`.
- `npm run rax -- run --mode learning_unit "Analyze the last weak planning run and propose how STAX should improve from it."`: passed, run `run-2026-04-25T15-31-13-384Z-uaal4m`.
- `npm run rax -- learn queue`: passed and printed pending trace/candidate queue items.
- `npm run rax -- learn metrics`: passed and printed `learning/metrics/learning_metrics.json`.
- `npm run rax -- show last`: passed and printed final output plus mode, validation, learning event, queues, and trace path.
- `npm run rax -- eval`: passed, 16/16, passRate 1, criticalFailures 0.
- `npm run rax -- eval --regression`: passed, 25/25, passRate 1, criticalFailures 0.
- `npm run rax -- run "STAX system improvement plan"`: passed, produced planning output rather than `stax_fitness`, run `run-2026-04-25T23-26-53-654Z-zlrxw0`.
- `npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."`: passed, run `run-2026-04-25T23-26-53-772Z-bqp737`.
- `npm run rax -- learn retention --dry-run`: passed, selected no runs for compaction because all discovered runs were inside the hot retention window.
- `npm run rax -- learn promote learn-2026-04-25T20-14-43-835Z-5r9hu3 --eval`: failed as expected with `Promotion requires --reason.` and recorded command LearningEvent `learn-7cef30f6ca0d2b21`.
- `npm run rax -- mode maturity`: passed; `stax_fitness` has `behavior_proven` with no proof gaps, while `learning_unit`, `project_brain`, `codex_audit`, `prompt_factory`, `test_gap_audit`, and `policy_drift` remain `usable` with replay/correction gaps.

## Addendum Evidence

- New regression evals: `evals/regression/command_learning_event_eval.json` and `evals/regression/promotion_requires_reason.json`.
- Command metadata proof: `learning/events/hot/learn-7cef30f6ca0d2b21.json` records `commandId`, `commands.commandName`, `commands.exitCode`, `promotion_failure`, and correction/eval candidate queues.
- Behavior tests prove replay drift queues eval/policy candidates, promotion failures queue correction/eval candidates, and retention excludes runs linked to durable artifacts.

## Proof Matrix

| Requirement | Evidence |
| --- | --- |
| Normal runs create LearningEvents | `tests/learningRuntime.test.ts`; run folders contain `learning_event.json`; trace contains `learningEventId` |
| Command-level events exist | `tests/learningRuntime.test.ts`; `learning/events/hot/learn-7cef30f6ca0d2b21.json` |
| STAX system prompts do not route to fitness | `tests/modeDetector.test.ts`; `evals/regression/stax_word_alone_not_fitness.json`; `npm run rax -- run "STAX system improvement plan"` |
| Explicit fitness prompts still work | `evals/regression/stax_fitness_explicit_still_fitness.json`; fitness smoke command |
| Weak/generic planning is detected | `tests/learningEvent.test.ts`; `GenericOutputDetector` specificity score tests |
| Queue items are schema-validated | `LearningQueueItemSchema`; `tests/learningRuntime.test.ts` |
| Proposals are source-linked and approval-gated | `LearningProposalGenerator`; unsafe-output proposal test |
| Promotion requires approval reason | `PromotionGate`; `promotion_requires_reason` eval; failed CLI proof |
| Retention is dry-run by default and preserves evidence | `LearningRetention`; retention durable-artifact test; retention dry-run CLI proof |
| Metrics update from real events | `LearningMetricsStore`; `tests/learningRuntime.test.ts`; `learning/metrics/learning_metrics.json` |

## Example LearningEvent

Planning smoke event:

```json
{
  "eventId": "learn-2026-04-25T20-14-40-563Z-0c1ixi",
  "runId": "run-2026-04-25T20-14-40-563Z-0c1ixi",
  "output": {
    "mode": "planning",
    "schemaValid": true,
    "criticPassed": true,
    "finalStatus": "success"
  },
  "proposedQueues": ["trace_only"],
  "links": {
    "tracePath": "runs/2026-04-25/run-2026-04-25T20-14-40-563Z-0c1ixi/trace.json",
    "finalPath": "runs/2026-04-25/run-2026-04-25T20-14-40-563Z-0c1ixi/final.md"
  }
}
```

The original weak prompt now passes planning hardening, so `trace_only` is expected. Generic weak output is still covered by detector tests and candidate queue tests.

## Example Command LearningEvent

Promotion without `--reason` creates a command event instead of silently failing:

```json
{
  "eventId": "learn-7cef30f6ca0d2b21",
  "runId": "cmd-7cef30f6ca0d2b21",
  "commandId": "cmd-7cef30f6ca0d2b21",
  "output": {
    "mode": "command",
    "finalStatus": "promotion_failure"
  },
  "commands": {
    "commandName": "learn promote",
    "success": false,
    "exitCode": 1,
    "denied": ["learn promote"]
  },
  "failureClassification": {
    "failureTypes": ["promotion_failure"]
  },
  "proposedQueues": ["correction_candidate", "eval_candidate"]
}
```

## Example Queue Item

```json
{
  "queueItemId": "learn-7cef30f6ca0d2b21-correction_candidate",
  "eventId": "learn-7cef30f6ca0d2b21",
  "runId": "cmd-7cef30f6ca0d2b21",
  "commandId": "cmd-7cef30f6ca0d2b21",
  "queueType": "correction_candidate",
  "reason": "correction_candidate created from promotion_failure: learn promote failed promotion approval or artifact creation.",
  "approvalState": "pending_review"
}
```

## Example Proposal

`learning/proposals/learn-7cef30f6ca0d2b21-proposal.md` includes:

```md
## Weakness Detected
- learn promote failed promotion approval or artifact creation.

## Proposed Codex Prompt
Implement the smallest behavior patch proved by this event...

## Source
- eventId: learn-7cef30f6ca0d2b21
- runId: cmd-7cef30f6ca0d2b21
- trace: learning/events/hot/learn-7cef30f6ca0d2b21.json

## Approval Required
- This proposal is evidence, not authority.
```

## Metrics Snapshot

`npm run rax -- learn metrics` produced:

```json
{
  "totalRuns": 131,
  "learningEventsCreated": 134,
  "schemaPassRate": 0.94,
  "criticPassRate": 0.94,
  "evalPassRate": 1,
  "planningSpecificityScore": 1
}
```

## Output Proofs

Planning output for the original weak prompt included the hardened sections:

```md
## Objective
## Current State
## Concrete Changes Required
## Files To Create Or Modify
## Tests / Evals To Add
## Commands To Run
## Acceptance Criteria
## Risks
## Rollback Plan
## Evidence Required
## Codex Prompt
```

Learning Unit output included:

```md
## Proposed LearningEvent
## Candidate Queues
- eval_candidate
- mode_contract_patch_candidate
- codex_prompt_candidate
## Approval Required
```

`rax show last` displayed the final response plus `Run`, `Mode`, `Validation`, `LearningEvent`, `LearningQueues`, and `Trace`.

## Routing Proof

- `npm run rax -- run "STAX system improvement plan"` returned planning output with the hardened planning contract and did not emit `## Signal Units`.
- `npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."` returned `## Signal Units`, `## Timeline`, `## Pattern Candidates`, `## Deviations`, `## Unknowns`, and `## Confidence Summary`.

## Registry Proof

- `docs/EVIDENCE_REGISTRY.md` now records `ev_005` through `ev_008` for identity routing, approved-learning runtime tests, regression evals, and this report.
- `docs/CLAIM_LEDGER.md` now marks `claim_stax_identity_system_not_fitness` and `claim_stax_v0_2_approved_learning_runtime` as proven with evidence IDs.
- `docs/PROVEN_WORKING.md` now includes STAX v0.2 approved-learning proof entries.

## Example Artifacts

- Planning smoke learning event: `runs/2026-04-25/run-2026-04-25T15-30-01-125Z-vzmjm2/learning_event.json`
- Learning unit smoke learning event: `runs/2026-04-25/run-2026-04-25T15-31-13-384Z-uaal4m/learning_event.json`
- Promotion failure command learning event: `learning/events/hot/learn-7cef30f6ca0d2b21.json`
- Metrics: `learning/metrics/learning_metrics.json`

## Final Claim Boundary

This implements an approved learning loop foundation. It does not implement autonomous learning or autonomous source modification.
