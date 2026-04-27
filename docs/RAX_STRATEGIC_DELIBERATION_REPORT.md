# RAX Strategic Deliberation Report

Date: 2026-04-27

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
Total: 25
STAXBetter: 25
ExternalBetter: 0
Ties: 0
NoExternalBaseline: 0
WorkLanes: 5
CaptureDates: 2
```

This is a candidate claim, not final broad superiority. The first single-case
slice proved the mechanism. The v1 holdout fixture expands the benchmark to 25
strategy cases across five work lanes and two capture dates. The added holdout
baselines are marked as seeded controls pending clean external capture; they
prove the breadth gate can run, while fresh external ChatGPT captures are still
needed for a final claim.

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

## Validation

```txt
npm run typecheck: passed
npm test: passed; 52 files / 245 tests
npm run rax -- eval: passed; 16/16
npm run rax -- eval --regression: passed; 46/46
npm run rax -- eval --redteam: passed; 9/9
npm test -- tests/strategicBenchmark.test.ts: passed; 4/4
npm run rax -- eval --regression --mode strategic_deliberation: passed; 3/3
npm run rax -- strategy benchmark: passed; Status broad_reasoning_candidate
npm run rax -- strategy prompt: passed
npm run rax -- run --mode strategic_deliberation "How should STAX become better than ChatGPT at broad reasoning?": passed
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes.": passed
```

## Limitations

- This does not prove STAX is broadly better than ChatGPT yet.
- The current provider is mock by default, so strategy output is draft-only.
- The expanded v1 benchmark uses seeded control baselines for breadth coverage;
  final superiority still requires fresh external captures that pass the drift
  gate.
- External ChatGPT STAX drifted during broad baseline capture. That is now a
  measured baseline-quality failure, not a hidden pass.
