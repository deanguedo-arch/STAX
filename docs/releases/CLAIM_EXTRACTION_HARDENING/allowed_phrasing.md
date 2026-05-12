# Claim Phrasing Rules

STAX treats completion, readiness, validation, success, and behavioral correctness language as proof-bearing claims.

## Allowed

- State what changed, then attach the required proof.
- Use `Provisional` when proof is incomplete.
- Say `not verified` when command, visual, data, release, security, approval, or protocol proof is missing.
- Scope Accept to the exact repo and worktree evidence STAX verified.

## Requires Proof

- `done`, `all set`, `resolved`, `completed`, or `implemented`
- `tests passed`, `checks are green`, `validated`, `build passed`, or `typecheck passed`
- `works`, `should work`, `ready to use`, or `behavior is verified`
- `looks good`, `layout fixed`, `rendered`, `screenshot`, or `CSS fixed`
- `data ready`, `row count matches`, `dry run`, or `canonical`
- `release ready`, `deploy`, `publish`, `sync`, `ship it`, or `ready to merge`
- `security fixed`, `secret safe`, `token safe`, `vulnerability closed`, or `injection blocked`
- `dependency updated`, lockfile readiness, package install readiness, or library upgrade
- migration, schema, rollback, downgrade, or database change readiness
- memory promotion, human approval, or durable learning claims
- STAX protocol, acknowledgement, heartbeat, current-turn, or report-contract compliance

## Not Allowed Without Proof

- Do not soften hard claims with vague language to avoid proof.
- Do not call a claim accepted because it sounds plausible.
- Do not use `Accept` for unsupported claim types; use `Provisional`, `Reject`, or `Human Review`.
