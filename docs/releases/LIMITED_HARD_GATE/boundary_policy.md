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

## Command Boundary Inference

When `stax preflight` receives a command after `--` and no explicit boundary is
provided, it infers obvious protected boundaries:

- `git tag <name>` -> release boundary
- `git push --tags` or `git push --follow-tags` -> release boundary
- `npm publish`, `pnpm publish`, or `yarn publish` -> release boundary
- `npm version`, `pnpm version`, or `yarn version` -> release boundary
- `gh release create ...` -> release boundary
- `docker push ...` -> release boundary
- deploy scripts and hosted deploy commands -> deploy boundary
- data publish or sync scripts -> data_publish boundary

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
