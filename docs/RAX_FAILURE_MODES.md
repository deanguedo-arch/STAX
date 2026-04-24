# RAX Failure Modes

## Prompt Drift
- Symptom: output no longer follows policy or mode contracts.
- Cause: prompt edits or provider drift.
- Detection: eval failures and trace diff.
- Mitigation: replay, restore policy bundle, add regression eval.

## Agent Overreach
- Symptom: agent adds unsupported facts or advice.
- Cause: weak mode enforcement.
- Detection: critic issues, schema/property eval failures.
- Mitigation: stricter mode validators and correction examples.

## False Refusals
- Symptom: safe requests are refused.
- Cause: overbroad risk terms.
- Detection: redteam and over-refusal evals.
- Mitigation: adjust rules and add allowed examples.

## Unsafe Misses
- Symptom: harmful or private content passes.
- Cause: weak risk classifier.
- Detection: redteam failures.
- Mitigation: hard-stop terms and safety policy updates.

## Memory Pollution
- Symptom: unapproved or raw model output appears in memory.
- Cause: auto-save or missing approval checks.
- Detection: memory tests and trace review.
- Mitigation: approved-only retrieval and memory policy.

## Bad Routing
- Symptom: wrong mode or agent selected.
- Cause: ambiguous terms or low confidence.
- Detection: mode evals and routing trace.
- Mitigation: mode detector rules and correction cases.

## Formatter Changing Meaning
- Symptom: final output introduces new claims.
- Cause: formatter overreach.
- Detection: critic and claim provenance checks.
- Mitigation: formatter-only policy and regression tests.

## Critic Rubber-Stamping
- Symptom: critic passes flawed output.
- Cause: weak critic rules or same-model bias.
- Detection: evaluator and correction loop.
- Mitigation: separate critic model/provider and stricter rubrics.

## Schema Bypass
- Symptom: invalid final output is returned.
- Cause: missing validation or repair handling.
- Detection: schema tests.
- Mitigation: validate, retry once, fail explicitly.

## Tool Misuse
- Symptom: unapproved write, shell, or git action.
- Cause: tool governance bypass.
- Detection: tool call logs.
- Mitigation: disabled defaults and allowed workspace checks.

## Eval Overfitting
- Symptom: evals pass but behavior degrades elsewhere.
- Cause: narrow exact-output tests.
- Detection: property evals and new redteam cases.
- Mitigation: broaden properties and goldens.

## Golden Brittleness
- Symptom: harmless wording changes fail.
- Cause: exact matching only.
- Detection: drift reports.
- Mitigation: property evals and similarity warnings.

## Correction Poisoning
- Symptom: poor corrections become training/memory.
- Cause: unapproved promotion.
- Detection: correction review.
- Mitigation: pending/approved states and explicit promotion.

## Provider Drift
- Symptom: real-model outputs change across runs.
- Cause: model updates or nondeterminism.
- Detection: replay drift.
- Mitigation: trace provider/model/seed and keep mock baseline.

## Replay Non-Determinism
- Symptom: mock replay differs.
- Cause: unlogged config or nondeterministic provider.
- Detection: replay exact-match test.
- Mitigation: config snapshot and deterministic mock provider.
