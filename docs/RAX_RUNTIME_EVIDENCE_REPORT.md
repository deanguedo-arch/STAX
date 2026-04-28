# RAX Runtime Evidence Report

Date: 2026-04-28

## Problem

Runtime/build/test truth requires command output. STAX needed a deterministic gate so these do not become fake-complete claims:

- package script exists
- test file exists
- source file was inspected
- STAX eval passed for STAX

None of those prove a linked repo build/test passed.

## Files Added

- `src/evidence/RuntimeEvidenceSchemas.ts`
- `src/evidence/RuntimeEvidenceGate.ts`
- `tests/runtimeEvidenceGate.test.ts`

## Behavior

`RuntimeEvidenceGate` classifies evidence strength:

- `none`
- `source_inspection`
- `script_discovered`
- `test_file_discovered`
- `pasted_command_output`
- `stored_command_evidence`
- `local_stax_command_evidence`

and runtime truth status:

- `unknown`
- `partial`
- `scoped_verified`
- `failed`

Failed command output overrides vague pass claims.

## Examples

- `package.json` script discovery: `unknown`.
- human-pasted command output: `partial`.
- stored command evidence: `scoped_verified`.
- STAX regression eval output for a `canvas-helper` claim: linked repo test pass remains `unknown`.
- failed command output: `failed`.

## What This Does Not Build

- No command runner.
- No linked repo execution.
- No linked repo mutation.
- No approval bypass.

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
