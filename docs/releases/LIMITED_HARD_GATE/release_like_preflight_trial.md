# Release-Like Preflight Trial

Generated for Phase 6 limited-gate rollout.

## Status

```txt
Status: passed
Scope: command-boundary inference and approval-gated release-like preflight
```

## Trial Cases

- `git tag stax-v1.0.0` infers `release`.
- `git push --tags` infers `release`.
- `git push origin main` infers `push`.
- `npm publish` infers `release`.
- `gh release create stax-v1.0.0` infers `release`.
- `npm run deploy` infers `deploy`.
- `SYNC_ALL.cmd` infers `data_publish`.

## Enforcement Result

Hard preflight with an accepted proof gate still blocks a release-like command
until a scoped approval artifact matches the current repo, boundary, and
worktree fingerprint.

## Boundary

This trial does not enable a live blocking switch. It proves that the local
preflight machinery can infer the first protected command boundary without
requiring the operator to pass an explicit boundary flag.
