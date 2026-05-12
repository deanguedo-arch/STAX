# Limited Hard Gate Boundary Policy

Generated for Phase 6 limited hard-gate planning.

## Scope

Hard gate applies only to protected boundaries:

- release command
- deploy command
- data publish command
- required CI check
- future protected merge or push boundary

Hard gate does not block ordinary local editing.

## Blocking Conditions

Hard gate blocks:

- `Reject`
- protocol failure
- stale command evidence
- tampered command evidence
- wrong-worktree command evidence
- provisional proof on protected claims
- human-review claim without a valid approval artifact

## Non-Goals

- no broad local-editing hard gate
- no automatic merge approval
- no automatic deploy approval
- no replacement for human review

