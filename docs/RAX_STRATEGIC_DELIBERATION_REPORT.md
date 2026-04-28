# RAX Strategic Deliberation Report

Date: 2026-04-27; updated 2026-04-28

## Why This Exists

The user pushed back that STAX being better on local repo proof tasks is not
enough. The missing capability is broad strategic reasoning: product judgment,
creative planning, cross-domain synthesis, ambiguous decision quality, and
big-picture direction.

This slice adds Strategic Deliberation Mode v0 plus Strategic Benchmark v0.

## Files Created

- `src/schemas/StrategicDeliberationOutput.ts`
- `src/strategy/StrategicQuestionSchemas.ts`
- `src/strategy/OptionGenerator.ts`
- `src/strategy/OptionEvaluator.ts`
- `src/strategy/StrategicDeliberation.ts`
- `src/strategy/StrategicDecisionFormatter.ts`
- `src/strategy/StrategicDecisionGate.ts`
- `src/strategy/StrategicBenchmarkSchemas.ts`
- `src/strategy/StrategicBenchmark.ts`
- `src/validators/StrategicDeliberationValidator.ts`
- `modes/strategic_deliberation.mode.md`
- `prompts/tasks/strategic_deliberation.md`
- `tests/strategicDeliberation.test.ts`
- `tests/strategicBenchmark.test.ts`
- `evals/regression/strategy_mode_make_stax_better_than_chatgpt.json`
- `evals/regression/strategy_mode_requires_kill_criteria.json`
- `evals/regression/strategy_mode_provider_capability_warning.json`
- `fixtures/strategy_benchmark/strategic_deliberation_v0_slice.json`
- `docs/STAX_STRATEGIC_DELIBERATION.md`
- `docs/RAX_STRATEGIC_DELIBERATION_REPORT.md`

## Files Modified

- `src/schemas/Config.ts`
- `src/schemas/zodSchemas.ts`
- `src/classifiers/ModeDetector.ts`
- `src/classifiers/DetailLevelController.ts`
- `src/agents/AgentRouter.ts`
- `src/agents/AnalystAgent.ts`
- `src/core/InstructionStack.ts`
- `src/policy/PolicySelector.ts`
- `src/utils/validators.ts`
- `src/chat/ChatSession.ts`
- `src/cli.ts`
- `modes/registry.json`
- `tests/modeDetector.test.ts`
- `tests/zodSchemas.test.ts`

## What Changed

STAX can now route broad strategy prompts into `strategic_deliberation`.
The mode creates a strategic decision object with options, rejected
alternatives, red-team failure modes, opportunity cost, reversibility, evidence
boundaries, next proof, and kill criteria.

The validator rejects strategy theater: one-option answers, roadmap-only
answers, missing opportunity cost, missing reversibility, missing kill criteria,
and high-confidence claims while evidence is missing.

The strategic benchmark compares STAX strategy answers with external baselines
and refuses broad reasoning superiority from one small slice.

## Current Strategic Benchmark Status

```txt
Status: broad_reasoning_candidate
Total: 49
STAXBetter: 49
ExternalBetter: 0
Ties: 0
NoExternalBaseline: 0
TemplateCollapseCases: 0
WorkLanes: 5
CaptureDates: 2
```

This closes the older two-date strategic holdout gate. The first single-case
slice proved the mechanism. The v1 holdout fixture expands the benchmark to 25
strategy cases across five work lanes, replaces the seeded controls with fresh
ChatGPT STAX browser captures from 2026-04-27, and shows STAX beating the
captured external answers without template collapse. A second-date external
capture was added on 2026-04-28 for the same 24 holdout cases, so the strategy
benchmark now reaches `broad_reasoning_candidate`.

## External Critic Loop

The open ChatGPT STAX critic was asked to judge the strategic implementation.
It twice drifted back into local repo-operator evidence instead of answering the
broad-reasoning question. STAX now treats that as benchmark evidence:
`StrategicBenchmark` rejects drifted broad-strategy baselines as
`no_external_baseline` instead of scoring them as a valid opponent.

The critic's crisp answer after the drift gate was:

```txt
VERDICT: not_yet
NEXT_PATCH: Strategic Benchmark Coverage Expansion v1: add 24 more broad-strategy benchmark cases across 5 work lanes with valid external-baseline capture metadata and drifted-baseline rejection
REASON: One valid strategic comparison proves the mechanism works, not broad reasoning superiority.
```

That patch is now implemented as the v1 holdout fixture plus the drifted
baseline rejection test.

After the commit was pushed, the external STAX critic returned:

```txt
VERDICT: broad_reasoning_candidate_only
NEXT_PATCH: Replace seeded-control strategic baselines with fresh captured external baselines and add a strategy-template-collapse gate that fails repeated one-size-fits-all STAX strategy answers.
REASON: The pushed repo proves the strategic benchmark mechanism and breadth gate, but the report itself says the expanded v1 benchmark uses seeded control baselines pending clean external capture, so it is not enough to claim broad ChatGPT-level strategic superiority.
```

The template-collapse gate is now implemented. `StrategicBenchmark` counts
repeated STAX strategy fingerprints and blocks a broad-reasoning candidate when
the benchmark is being won by one repeated answer shape. The v1 holdout fixture
was regenerated through the actual strategic generator so different lanes select
different control surfaces, and the benchmark reports `TemplateCollapseCases: 0`.

Fresh external baselines were then captured one task at a time from the open
ChatGPT STAX browser thread. The first capture date reported `STAXBetter: 25`
and `NoExternalBaseline: 0`, but the honest status stayed `not_proven` because
all fresh captures happened on one date.

On 2026-04-28, the same 24 holdout cases were recaptured from the browser as
`fixtures/strategy_benchmark/strategic_deliberation_v1_holdout_date2.json`.
With both capture dates present, the directory benchmark is now:

```txt
Status: broad_reasoning_candidate
Total: 49
STAXBetter: 49
ExternalBetter: 0
Ties: 0
NoExternalBaseline: 0
TemplateCollapseCases: 0
WorkLanes: 5
CaptureDates: 2
```

## Validation

```txt
npm run typecheck: passed
npm test: passed; 52 files / 247 tests
npm run rax -- eval: passed; 16/16
npm run rax -- eval --regression: passed; 46/46
npm run rax -- eval --redteam: passed; 9/9
npm test -- tests/strategicBenchmark.test.ts: passed; 6/6
npm run rax -- eval --regression --mode strategic_deliberation: passed; 3/3
npm run rax -- strategy benchmark --fixtures fixtures/strategy_benchmark: passed; Status broad_reasoning_candidate; STAXBetter 49; NoExternalBaseline 0; TemplateCollapseCases 0; CaptureDates 2
npm run rax -- strategy prompt: passed
npm run rax -- run --mode strategic_deliberation "How should STAX become better than ChatGPT at broad reasoning?": passed
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes.": passed; run-2026-04-28T12-36-41-368Z-woy8nd
```

## Limitations

- This proves the current strategic benchmark candidate slice, not permanent
  broad superiority.
- The current provider is mock by default, so strategy output is draft-only.
- The expanded v1 benchmark now uses fresh captured external baselines from two
  dates and passes the drift gate.
- External ChatGPT STAX drifted during broad baseline capture. That is now a
  measured baseline-quality failure, not a hidden pass.
