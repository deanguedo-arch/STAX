# STAX Chat Operator Receipts

Chat Operator v1B adds Operation Receipts so normal-language control requests
cannot look complete without proof.

Outcome Header v0 sits in front of those receipts so STAX cannot hide a weak
answer behind proof sections. The useful answer comes first; the receipt comes
after.

The receipt is a control surface, not a new promotion system.

## Required Sections

```md
## Direct Answer
## One Next Step
## Why This Step
## Proof Status
## Receipt
## Operation
## Evidence Required
## Actions Run
## Evidence Checked
## Artifacts Created
## Claims Verified
## Claims Not Verified
## Missing Evidence
## Fake-Complete Risks
## Next Allowed Action
```

## Rules

- answer the user's actual request before rendering the receipt
- provide exactly one primary next step
- reject generic next steps such as `review the evidence`, `continue analysis`,
  `improve the repo`, `check the tests`, and `investigate further`
- manual or external command steps must say what to paste back
- every verified claim cites evidence
- pasted claims are not local command proof
- file listings prove file presence only
- test files or scripts do not prove tests pass
- blocked/deferred requests must say no action executed
- no receipt approves, promotes, mutates, trains, or changes policy

## Proof Quality

Receipts include:

```txt
ProofQuality: sufficient | partial | insufficient
PromotionStatus: not_allowed | blocked
MutationStatus: none
```

Most current operator receipts are intentionally `partial`: they can prove
read-only inspection, queue reads, or audit-run creation, but they cannot prove
runtime behavior unless command/eval evidence exists.

## Fake-Complete Example

Bad:

```txt
Claims Verified:
- Tests passed [evidence: repo evidence pack]
```

Good:

```txt
Direct Answer:
STAX found test/script evidence, but it did not run tests; pass/fail is unknown.

One Next Step:
Run `npm test` in the target repo and paste back the full output, exit code if available, and failing test names if any.

Claims Verified:
- package.json scripts were extracted read-only [evidence: repo-script:test]

Claims Not Verified:
- Tests were found, but no test command was executed by this operator; pass/fail is unknown.

Fake-Complete Risks:
- Finding test scripts or test files does not prove tests pass.
```

## Boundaries

Operation Receipts do not:

- approve memory
- promote evals
- export training data
- mutate linked repos
- run arbitrary shell commands
- mark Project Brain state as proven
- make STAX autonomous
