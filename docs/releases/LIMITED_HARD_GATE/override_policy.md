# Limited Hard Gate Override Policy

Generated for Phase 6 limited hard-gate planning.

## Soft Gate

Soft gate may continue when a bypass reason is recorded. The bypass event must
include actor, boundary, repo hash, verdict, protocol status, and reason.

## Hard Gate

Hard gate does not accept a free-form bypass for evidence integrity failures.

A scoped approval artifact may satisfy only `Human Review` or `Provisional`
boundaries when:

- the approval schema is recognized
- repo path hash matches
- boundary matches
- worktree fingerprint matches when specified
- approval is not expired
- approver and reason are present

## Evidence Integrity

Stale, tampered, wrong-repo, wrong-branch, wrong-cwd, wrong-commit, wrong-
worktree, missing-stream-hash, and ledger-unverified evidence remains blocking.

