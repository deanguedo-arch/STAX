# RAX 100 Proof Report

## Verdict

Behavior System v0.1.

This verdict is bounded to the local/mock-provider system. It does not claim frontier-model capability, autonomous behavior, or external fine-tuning. It means the critical local behavior claims now have tests, evals, traces, replay checks, and correction pressure behind them.

## Gate Results

| Gate | Pass/Fail/Partial | Evidence | Remaining Issue |
| --- | --- | --- | --- |
| 1. True provider role separation | Pass | `tests/behavior100Proof.test.ts` injects distinct generator, critic, and formatter providers and asserts actual calls plus trace `modelCalls`; `src/core/RaxRuntime.ts` honors `roleProviders`. | Live default config still uses mock providers for all roles, by design. |
| 2. Critical critic hard-stop | Pass | `CriticGate` marks STAX forbidden/personality/coaching violations as critical; runtime returns `## Critic Failure`, skips formatter, records `validation.valid=false`, and writes `repair.md` as `not_attempted_due_to_critical`. | Repair remains deterministic and simple for non-critical failures. |
| 3. Negative-control eval traps | Pass | `tests/behavior100Proof.test.ts` runs CLI eval against a critical bad fixture and expects exit code 1; `PropertyEvaluator` enforces sections, forbidden patterns, signal counts, boundary mode, provider-call checks, and critic failure properties. | Negative fixtures are test-local except for durable STAX regression cases. |
| 4. Messy STAX atomic extraction | Pass | Latest messy STAX run produced six Signal Units: training, sleep, recovery, strain, injury/self-report, and nutrition. | Extraction is still rules-based, so new source formats need new tests before support. |
| 5. Correction pressure | Pass | `corr-stax-atomic-proof` exists in `corrections/approved`, `evals/regression`, `training/corrections`, and `goldens`; SFT export includes it and preference export now has a chosen/rejected pair. | Current durable correction set is intentionally small. |
| 6. Trace-level replay | Pass | `Replay.ts` compares final output plus deterministic trace fields: mode, boundary, selected agent, policies, model-call roles, validation, schema retries, and repair passes. Test mutates `policiesApplied` and expects trace drift. | Latency, run id, and timestamps are intentionally ignored. |

## Command Results

- `npm run typecheck`: passed.
- `npm test`: passed, 27 test files and 70 tests.
- `npm run build`: passed.
- `npm run rax -- run --mode stax_fitness --file <messy-input>`: passed, run `run-2026-04-24T21-10-59-548Z-qlah1e`.
- `npm run rax -- eval`: passed, 16/16, passRate 1, criticalFailures 0.
- `npm run rax -- eval --mode stax_fitness`: passed, 2/2, passRate 1, criticalFailures 0.
- `npm run rax -- eval --redteam`: passed, 9/9, passRate 1, criticalFailures 0.
- `npm run rax -- eval --regression`: passed, 7/7, passRate 1, criticalFailures 0.
- `npm run rax -- replay run-2026-04-24T21-10-59-548Z-qlah1e`: passed with `exact=true`, `outputExact=true`, `traceExact=true`.
- `npm run rax -- train export --sft`: passed, 9 records.
- `npm run rax -- train export --preference`: passed, 1 record.

## Latest Messy STAX Output

Input:

```txt
Saturday: Dean trained BJJ for 90 minutes.
Sunday: slept 8 hours.
WHOOP showed recovery 34%, strain 11.8.
He said "my knee felt stable."
Ate 220g protein.
```

Output summary:

- `SU-001`: training, Saturday, Dean trained BJJ for 90 minutes.
- `SU-002`: sleep, Sunday, Dean slept 8 hours.
- `SU-003`: recovery, unknown timestamp, WHOOP showed recovery 34%.
- `SU-004`: strain, unknown timestamp, WHOOP strain 11.8.
- `SU-005`: injury/self-report, unknown timestamp, quote preserved.
- `SU-006`: nutrition, unknown timestamp, 220g protein.

The output kept `Pattern Candidates` as `Insufficient signals` and `Deviations` as `Insufficient baseline`.

## Latest Trace modelCalls

From `runs/2026-04-24/run-2026-04-24T21-10-59-548Z-qlah1e/trace.json`:

```json
[
  { "role": "generator", "provider": "mock", "model": "mock-generator" },
  { "role": "critic", "provider": "mock", "model": "mock-critic" },
  { "role": "formatter", "provider": "mock", "model": "mock-generator" }
]
```

The stronger role-separation proof is in `tests/behavior100Proof.test.ts`, which injects distinct fake providers and verifies those exact providers were called and logged.

## Replay Diff Summary

Replay result for `run-2026-04-24T21-10-59-548Z-qlah1e`:

```json
{
  "exact": true,
  "outputExact": true,
  "traceExact": true,
  "outputDiffSummary": "exact match",
  "traceDiffSummary": "mock replay deterministic trace matched"
}
```

The negative replay proof mutates `policiesApplied` in a saved trace and confirms replay reports a deterministic trace diff.

## Correction Promotion Evidence

Durable correction pressure artifacts:

- `corrections/approved/corr-stax-atomic-proof.json`
- `evals/regression/corr-stax-atomic-proof.json`
- `training/corrections/corr-stax-atomic-proof.json`
- `goldens/corr-stax-atomic-proof.md`

The correction preserves the rejected merged-signal output and the chosen two-signal output. The regression eval requires at least two STAX Signal Units for the original BJJ + sleep input.

## Training Export Line Counts

- `training/exports/sft.jsonl`: 9 JSONL records.
- `training/exports/preference.jsonl`: 1 JSONL record.

The preference record contains a non-empty `chosen` corrected output and non-empty `rejected` merged-signal output.

## Remaining Limitations

- STAX extraction is deterministic and rules-based. It is now covered for messy pasted observations, but new source formats still need test-first additions.
- Provider role separation is proven locally with fake providers and trace logs. Real OpenAI/Ollama role routing remains configuration-dependent.
- Repair is intentionally one-pass and simple. Critical failures hard-stop; non-critical repair is not a model-quality repair loop yet.
- Eval property checks are deterministic. They are stronger than heading-only checks, but they are not semantic model judging.
