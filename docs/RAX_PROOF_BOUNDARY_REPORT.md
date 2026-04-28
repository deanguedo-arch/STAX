# RAX Proof Boundary Report

Date: 2026-04-28

## Problem

STAX could score or explain adjacent evidence too broadly. The failure shape is subtle:

- DOCX proof is not PDF proof.
- OCR proof is not structured recovery proof.
- `test:course-shell` proof is not full e2e or rendered preview proof.
- fixture proof is not rendered export proof.
- `cf:convert` proof is not `cf:validate` proof.
- a repo with no test script does not have passing `npm test`.

## Files Added

- `src/evidence/ProofBoundarySchemas.ts`
- `src/evidence/ProofBoundaryClassifier.ts`
- `tests/proofBoundaryClassifier.test.ts`
- `evals/regression/proof_boundary_distinctions.json`

## Behavior

`ProofBoundaryClassifier` maps supplied evidence into an evidence family and returns:

- verified scope
- unverified scope
- required next proof

This keeps narrow proof from leaking into broader claims.

## Examples

- Evidence family `docx` verifies `DOCX parsing path only`; PDF remains unverified.
- Evidence family `course_shell` verifies shell generation checks; full e2e/rendered preview/export quality remain unverified.
- Evidence family `conversion` verifies conversion command output; validation success remains unverified until validate/audit evidence exists.

## What This Does Not Build

- No LLM classifier.
- No visual screenshot protocol yet.
- No linked repo mutation.
- No broad runtime rewrite.

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
