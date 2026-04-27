# RAX Chat Operator Receipts Report

Date: 2026-04-27

Status: implemented.

## Summary

Chat Operator v1B adds Operation Receipts and a Proof Quality Gate for the
existing natural-language operator surface.

The goal is to prevent proof theater:

```txt
nice sections + traces + queues != solved user problem
```

Every recognized operator request now renders a validated receipt that separates
verified claims from unsupported claims and explicitly names fake-complete risks.

## Consensus

Red Team, Blue Team, and implementation review aligned on the same slice:

```txt
Build Operation Receipts now.
Defer Project Brain, autonomy, UI, memory promotion, training, and source mutation.
```

## Files Created

- `src/operator/OperationReceipt.ts`
- `src/operator/OperationReceiptValidator.ts`
- `tests/chatOperatorReceipt.test.ts`
- `docs/STAX_CHAT_OPERATOR_RECEIPTS.md`
- `docs/RAX_CHAT_OPERATOR_RECEIPTS_REPORT.md`

## Files Modified

- `src/operator/OperationSchemas.ts`
- `src/operator/OperationFormatter.ts`
- `src/operator/OperationExecutor.ts`
- `src/operator/OperationRiskGate.ts`
- `src/operator/ChatIntentClassifier.ts`
- `tests/chatOperator.test.ts`
- `tests/chatSession.test.ts`
- `docs/STAX_CHAT_OPERATOR.md`
- `docs/STAX_NEXT_10_PHASES_CONSENSUS.md`

## Receipt Contract

Required receipt sections:

```txt
Operation
Evidence Required
Actions Run
Evidence Checked
Artifacts Created
Claims Verified
Claims Not Verified
Missing Evidence
Fake-Complete Risks
Next Allowed Action
```

Proof status fields:

```txt
ProofQuality
PromotionStatus
MutationStatus
```

## Validator Rules

- Verified claims require evidence references.
- Vague evidence like `Repo evidence pack` is not enough for completion claims.
- Test/script discovery requires a not-verified claim that pass/fail is unknown.
- Test/script discovery requires a fake-complete risk saying test presence does
  not prove tests pass.
- Blocked/deferred receipts can only show the risk gate as run.
- `MutationStatus` must remain `none`.
- `PromotionStatus` must remain `not_allowed` or `blocked`.

## Behavior Examples

`what tests exist in this repo?`

```txt
Claims Verified:
- package.json scripts were extracted read-only [evidence: repo-script:test]
- Test files were enumerated read-only [evidence: repo-test:...]

Claims Not Verified:
- Tests were found, but no test command was executed by this operator; pass/fail is unknown.

Fake-Complete Risks:
- Finding test scripts or test files does not prove tests pass.
```

`approve all memory candidates`

```txt
Status: blocked
Claims Verified:
- No operation action was executed because the risk gate blocked the request.
PromotionStatus: blocked
MutationStatus: none
```

## No Promotion Proof

This slice does not write to:

- `memory/approved`
- active regression eval promotion paths
- training exports
- policies
- schemas
- modes
- linked external repos

It changes only the operator response contract, validation, tests, and docs.

## Validation

Final validation commands:

```txt
npm run typecheck
npm test
npm run rax -- eval
npm run rax -- eval --regression
npm run rax -- eval --redteam
npm run rax -- chat --once "what tests exist in this repo?"
```

Observed results:

```txt
npm run typecheck: passed
npm test: 47 files / 186 tests passed
npm run rax -- eval: 16/16 passed
npm run rax -- eval --regression: 43/43 passed
npm run rax -- eval --redteam: 9/9 passed
npm run rax -- chat --once "what tests exist in this repo?": passed; receipt reported tests found but not run, pass/fail unknown
npm run rax -- chat --once "approve all memory candidates": passed; hard-block no-action receipt
```

## Remaining Limitations

- Receipts do not yet make Project Brain durable state.
- Receipts do not run linked repo tests.
- Receipts do not execute Codex handoffs.
- Receipts do not auto-promote anything.
- ProofQuality is intentionally conservative and currently favors `partial`
  unless there is direct command/eval/runtime proof.
