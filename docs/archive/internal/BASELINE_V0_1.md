# Baseline v0.1

Source: `docs/RAX_100_PROOF_REPORT.md`.

## Baseline Verdict

Behavior System v0.1, bounded to the local/mock-provider system.

## Test Count

- `npm test`: 27 test files and 70 tests passed at baseline.

## Eval Results

- `npm run rax -- eval`: 16/16 passed.
- `npm run rax -- eval --mode stax_fitness`: 2/2 passed.
- `npm run rax -- eval --redteam`: 9/9 passed.
- `npm run rax -- eval --regression`: 7/7 passed.

## Replay Result

- Replay for `run-2026-04-24T21-10-59-548Z-qlah1e` passed with `exact=true`, `outputExact=true`, and `traceExact=true`.

## STAX Messy Run Result

- Latest messy STAX run produced six atomic signal units: training, sleep, recovery, strain, injury/self-report, and nutrition.

## Training Export Counts

- SFT export: 9 JSONL records.
- Preference export: 1 JSONL record.

## Known Limitations

- STAX extraction is deterministic and rules-based.
- Real provider role routing remains config-dependent.
- Repair is intentionally one-pass and simple.
- Eval property checks are deterministic, not semantic model judging.

## Latest Proof Report

- `docs/RAX_100_PROOF_REPORT.md`
