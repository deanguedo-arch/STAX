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

## Fresh Agent Review Patch

The 2026-04-28 red/blue/green review found three runtime-evidence gaps:

- `repo` metadata was ignored for linked-repo scope.
- success summaries such as `failed=0` could be treated as failures.
- failed stored evidence with an `exitCode: 1` marker could be missed.

`RuntimeEvidenceGate` now uses `repo` metadata for linked-repo boundaries,
distinguishes zero failed counts from actual failures, and treats nonzero
stored command exit codes as failed evidence. `EvidenceDecisionGate` now also
uses runtime evidence and proof-boundary classification when rendering scope
and required next proof.

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

npm test -- tests/firstPassIntegrityGate.test.ts tests/proofBoundaryClassifier.test.ts tests/runtimeEvidenceGate.test.ts tests/generalSuperiorityGate.test.ts tests/evidenceDecisionGate.test.ts
5 files / 32 tests passed

npm test
55 files / 272 tests passed

npm run rax -- eval
16/16 passed

npm run rax -- eval --regression
47/47 passed

npm run rax -- eval --redteam
9/9 passed

npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
smoke passed
```
