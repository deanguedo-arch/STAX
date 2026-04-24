# RAX Failure Modes

## Prompt Drift
- Symptom: output no longer follows policy or mode contracts.
- Cause: prompt edits or provider drift.
- Detection: eval failures and trace diff.
- Mitigation: replay, restore policy bundle, add regression eval.
- Test/Eval: `npm run rax -- eval`, replay tests.

## Agent Overreach
- Symptom: agent adds unsupported facts or advice.
- Cause: weak mode enforcement.
- Detection: critic issues, schema/property eval failures.
- Mitigation: stricter mode validators and correction examples.
- Test/Eval: `tests/criticGateHardening.test.ts`, STAX regression evals.

## False Refusals
- Symptom: safe requests are refused.
- Cause: overbroad risk terms.
- Detection: redteam and over-refusal evals.
- Mitigation: adjust rules and add allowed examples.
- Test/Eval: redteam over-refusal eval.

## Unsafe Misses
- Symptom: harmful or private content passes.
- Cause: weak risk classifier.
- Detection: redteam failures.
- Mitigation: hard-stop terms and safety policy updates.
- Test/Eval: redteam privacy/system/actionable-harm evals.

## Memory Pollution
- Symptom: unapproved or raw model output appears in memory.
- Cause: auto-save or missing approval checks.
- Detection: memory tests and trace review.
- Mitigation: approved-only retrieval and memory policy.
- Test/Eval: `tests/memoryApproval.test.ts`.

## Bad Routing
- Symptom: wrong mode or agent selected.
- Cause: ambiguous terms or low confidence.
- Detection: mode evals and routing trace.
- Mitigation: mode detector rules and correction cases.
- Test/Eval: `tests/modeDetector.test.ts`, mode eval cases.

## Formatter Changing Meaning
- Symptom: final output introduces new claims.
- Cause: formatter overreach.
- Detection: critic and claim provenance checks.
- Mitigation: formatter-only policy and regression tests.
- Test/Eval: `tests/criticGateHardening.test.ts`.

## Critic Rubber-Stamping
- Symptom: critic passes flawed output.
- Cause: weak critic rules or same-model bias.
- Detection: evaluator and correction loop.
- Mitigation: separate critic model/provider and stricter rubrics.
- Test/Eval: `tests/criticGateHardening.test.ts`.

## Schema Bypass
- Symptom: invalid final output is returned.
- Cause: missing validation or repair handling.
- Detection: schema tests.
- Mitigation: validate, retry once, fail explicitly.
- Test/Eval: `tests/zodSchemas.test.ts`, `tests/schemaValidation.test.ts`.

## Tool Misuse
- Symptom: unapproved write, shell, or git action.
- Cause: tool governance bypass.
- Detection: tool call logs.
- Mitigation: disabled defaults and allowed workspace checks.
- Test/Eval: `tests/toolGovernance.test.ts`, redteam tool abuse eval.

## Eval Overfitting
- Symptom: evals pass but behavior degrades elsewhere.
- Cause: narrow exact-output tests.
- Detection: property evals and new redteam cases.
- Mitigation: broaden properties and goldens.
- Test/Eval: `tests/evalProperties.test.ts`.

## Golden Brittleness
- Symptom: harmless wording changes fail.
- Cause: exact matching only.
- Detection: drift reports.
- Mitigation: property evals and similarity warnings.
- Test/Eval: golden-backed eval cases.

## Correction Poisoning
- Symptom: poor corrections become training/memory.
- Cause: unapproved promotion.
- Detection: correction review.
- Mitigation: pending/approved states and explicit promotion.
- Test/Eval: `tests/correctionPromotion.test.ts`.

## Provider Drift
- Symptom: real-model outputs change across runs.
- Cause: model updates or nondeterminism.
- Detection: replay drift.
- Mitigation: trace provider/model/seed and keep mock baseline.
- Test/Eval: `tests/providerRoleTrace.test.ts`.

## Replay Non-Determinism
- Symptom: mock replay differs.
- Cause: unlogged config or nondeterministic provider.
- Detection: replay exact-match test.
- Mitigation: config snapshot and deterministic mock provider.
- Test/Eval: `tests/replay.test.ts`.

## STAX Signal Merging
- Symptom: multiple observations collapse into one Signal Unit.
- Cause: treating the whole input as one observation.
- Detection: STAX atomic regression evals and signal-count tests.
- Mitigation: atomic observation splitter and minSignalUnits eval property.
- Test/Eval: `tests/staxAtomicExtraction.test.ts`, `evals/regression/stax_multiple_observations_atomic.json`.

## Shallow Eval Pass
- Symptom: eval passes even though behavior is wrong.
- Cause: checking only command completion or broad headings.
- Detection: property failures, min signal unit checks, critical eval failure counts.
- Mitigation: enforce required sections, forbidden patterns, expected properties, pass rate, and critical failure gates.
- Test/Eval: `tests/evalProperties.test.ts`, `tests/eval.test.ts`.

## Policy Dumping
- Symptom: compiled prompt includes unrelated policies.
- Cause: selector ignores mode, memory, tools, boundary, or correction context.
- Detection: policy selection tests and prompt inspection.
- Mitigation: conditional policy selection and explicit conflict resolution metadata.
- Test/Eval: `tests/policyEngine.test.ts`.
