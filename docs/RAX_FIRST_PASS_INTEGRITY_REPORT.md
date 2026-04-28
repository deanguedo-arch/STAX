# RAX First-Pass Integrity Report

Date: 2026-04-28

## Problem

Corrected holdout wins can be useful learning evidence, but they are not blind first-pass superiority proof. STAX needed a deterministic way to prevent:

- relabelling corrected fixtures as `blind_first_pass`
- hiding first-pass ties or losses
- overwriting locked first-pass fixtures while scoring
- reaching `superiority_candidate` from corrected-only evidence

## Files Added

- `src/compare/FirstPassIntegritySchemas.ts`
- `src/compare/FirstPassIntegrityGate.ts`
- `tests/firstPassIntegrityGate.test.ts`

## Behavior

The gate labels benchmark evidence as:

- `blind_first_pass`
- `post_correction_pass`
- `trained_slice_pass`
- `superiority_candidate`

Blind first-pass eligibility requires:

- locked first-pass evidence
- recorded first-pass score
- locked fixture path
- no post-correction flag
- no STAX answer edit after external capture
- first-pass winner is not a tie/loss

## Pass/Fail Examples

- Locked first-pass STAX win: allowed as `blind_first_pass`.
- Corrected fixture after tie/loss: forced to `post_correction_pass`.
- Locked fixture overwrite attempt: blocked.
- Corrected-only evidence requesting `superiority_candidate`: blocked.

## What This Does Not Build

- No benchmark auto-editing.
- No fixture mutation.
- No automatic superiority claim.
- No promotion to memory/evals/training.

## Validation

Commands run:

```txt
npm run typecheck
passed

npm test -- tests/firstPassIntegrityGate.test.ts tests/proofBoundaryClassifier.test.ts tests/runtimeEvidenceGate.test.ts
3 files / 17 tests passed

npm test
55 files / 265 tests passed

npm run rax -- eval
16/16 passed

npm run rax -- eval --regression
47/47 passed

npm run rax -- eval --redteam
9/9 passed

npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
smoke passed
```
