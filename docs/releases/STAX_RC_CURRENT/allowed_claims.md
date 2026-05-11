# STAX RC Current Allowed Claims

These claims are allowed for the current RC when paired with the command proof in
`command_proof.md`.

## Product Identity

- STAX is a local proof gate for AI-coded work.
- STAX catches fake-complete AI coding work before you trust it.
- STAX audits claims against repo state, command evidence, proof artifacts, and
  human-review requirements.

## Current Capability Claims

- STAX can attach a sidecar to a repo.
- STAX can collect command evidence through `stax collect`.
- STAX can run a gate that writes status, proof-strength, proof-report, and next
  prompt artifacts.
- STAX can verify local command evidence provenance before treating it as strong
  proof.
- STAX can reject stale, tampered, wrong-repo, wrong-branch, wrong-cwd, wrong-
  commit, or wrong-worktree command evidence when those checks apply.
- STAX can summarize proof strength as a claim-specific evidence score, not a
  truth score.
- STAX has an observer/soft/hard enforcement model in code that is ready for
  measured rollout trials.

## Baseline Validation Claims

- On 2026-05-11, Phase 0 commands passed locally at
  `8b6c8c139e1bf81bfc7e181d7487dca0b1dd9828`.
- `npm ci`, `npm run typecheck`, `npm test`, `npm run smoke:stax`, and
  `npm run rax -- eval` all completed with exit code 0 for this baseline.

## Correct Accept Boundary

The safe wording is:

```txt
Accept means required claims are supported by verified evidence for this repo
state.
```

It is not safe to shorten this to:

```txt
Accept means the code is correct.
```
