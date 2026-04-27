# STAX Chat Operator Receipts

Chat Operator v1B adds Operation Receipts so normal-language control requests
cannot look complete without proof.

The receipt is a control surface, not a new promotion system.

## Required Sections

```md
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
