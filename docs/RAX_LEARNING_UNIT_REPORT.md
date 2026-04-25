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

## Limitations

- Policy/schema/mode promotions create proposal artifacts first; direct source patching remains out of scope.
- Retention defaults to dry-run and must be applied explicitly with a reason.
- This is an approved learning loop, not autonomous learning.

## Command Evidence

- `npm run typecheck`: passed.
- `npm test`: passed, 33 test files and 93 tests.
- `npm run rax -- run --mode planning "Ok what i need then is at a base level i need you to ask it how to make this into a learning unit that takes every input and question and process and it gets better and better over time."`: passed, run `run-2026-04-25T15-30-01-125Z-vzmjm2`.
- `npm run rax -- run --mode learning_unit "Analyze the last weak planning run and propose how STAX should improve from it."`: passed, run `run-2026-04-25T15-31-13-384Z-uaal4m`.
- `npm run rax -- learn queue`: passed and printed pending trace/candidate queue items.
- `npm run rax -- learn metrics`: passed and printed `learning/metrics/learning_metrics.json`.
- `npm run rax -- show last`: passed and printed final output plus mode, validation, learning event, queues, and trace path.
- `npm run rax -- eval`: passed, 16/16, passRate 1, criticalFailures 0.
- `npm run rax -- eval --regression`: passed, 23/23, passRate 1, criticalFailures 0.
- `npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."`: passed, run `run-2026-04-25T15-32-18-273Z-tt5nk3`.
- `npm run rax -- learn retention --dry-run`: passed, selected no runs for compaction because all discovered runs were inside the hot retention window.

## Example Artifacts

- Planning smoke learning event: `runs/2026-04-25/run-2026-04-25T15-30-01-125Z-vzmjm2/learning_event.json`
- Learning unit smoke learning event: `runs/2026-04-25/run-2026-04-25T15-31-13-384Z-uaal4m/learning_event.json`
- Metrics: `learning/metrics/learning_metrics.json`

## Final Claim Boundary

This implements an approved learning loop foundation. It does not implement autonomous learning or autonomous source modification.
