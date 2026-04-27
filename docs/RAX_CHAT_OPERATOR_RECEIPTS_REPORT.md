# RAX Chat Operator Receipts Report

Date: 2026-04-27

Status: implemented and extended with Outcome Header v0 and Problem Movement
Gate v0.

## Summary

Chat Operator v1B adds Operation Receipts and a Proof Quality Gate for the
existing natural-language operator surface. Outcome Header v0 now requires the
operator to answer first, give one concrete next step, and only then render the
proof receipt. Problem Movement Gate v0 now rejects safe-looking operator
answers that do not actually move the user's problem forward.

The goal is to prevent proof theater:

```txt
nice sections + traces + queues != solved user problem
```

Every recognized operator request now renders a validated receipt that separates
verified claims from unsupported claims and explicitly names fake-complete risks.
Every recognized operator response now starts with:

```txt
Direct Answer
One Next Step
Why This Step
Proof Status
ProblemMovement
MovementMade
RequiredEvidence
Receipt
```

## Consensus

Red Team, Blue Team, and implementation review aligned on the same slice:

```txt
Answer first.
One concrete next step second.
Proof receipt third.
```

Do not add a Workspace Action Board, Codex Task Loop, durable Project Brain
state, new review queue, approval path, or promotion path in this slice.

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

Required outcome and receipt sections:

```txt
Direct Answer
One Next Step
Why This Step
Proof Status
Receipt
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

- recognized operator output must render the outcome header before the receipt
- Direct Answer cannot be empty
- One Next Step must contain exactly one primary bullet
- One Next Step must start with a concrete action verb
- One Next Step must not offer multiple command alternatives
- generic steps like `review the evidence`, `continue analysis`, and
  `improve the repo` fail validation
- manual command steps must say what to paste back
- blocked/deferred answers must state no action was executed
- blocked chat answers cannot surface promotion commands as the one next step
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
Direct Answer:
STAX found test/script evidence and test files by read-only inspection, but it did not run tests; pass/fail is unknown.

One Next Step:
Run `npm test` in the target repo and paste back the full output, exit code if available, and failing test names if any.

ProblemMovement:
needs_evidence

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
Direct Answer:
Blocked. STAX did not execute the requested operation, approve anything, promote anything, or mutate durable state.

One Next Step:
Run `npm run rax -- learn queue` to inspect candidates before any approval or promotion path; paste back the output.

Status: blocked
ProblemMovement: blocked
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
npm run rax -- chat --once "approve all memory candidates"
```

Observed results:

```txt
npm run typecheck: passed
npm test: 48 files / 201 tests passed
npm run rax -- eval: 16/16 passed
npm run rax -- eval --regression: 43/43 passed
npm run rax -- eval --redteam: 9/9 passed
npm run rax -- chat --once "what tests exist in this repo?": passed; Direct Answer reported tests found but not run, pass/fail unknown, and One Next Step gave `npm test` plus paste-back instructions
npm run rax -- chat --once "approve all memory candidates": passed; hard-block Direct Answer reported no action executed and One Next Step used `npm run rax -- learn queue` instead of a promotion command
```

## Remaining Limitations

- Receipts do not yet make Project Brain durable state.
- Receipts do not run linked repo tests.
- Receipts do not execute Codex handoffs.
- Receipts do not auto-promote anything.
- ProofQuality is intentionally conservative and currently favors `partial`
  unless there is direct command/eval/runtime proof.
- Outcome Header v0 does not persist next actions into an Action Board; that is
  intentionally deferred until the answer-first behavior proves useful.
- Problem Movement Gate v0 is deterministic and conservative; it only covers
  Chat Operator output in this slice.
