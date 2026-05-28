# STAX RC Current Known Limits

This file defines what the current RC does not yet prove. These limits are part
of the Phase 0 baseline and should not be softened without new command proof,
fixtures, rollout data, or human approval.

## Operational Limits

- STAX is strong for scoped Codex/repo project-control dogfooding and
  observer-mode proof gates.
- `Accept` means required claims are supported by verified evidence for the
  audited repo state. It does not mean the code is generally correct.
- Local command evidence is stronger than Codex-reported evidence, but it is not
  a guarantee against a privileged local adversary.
- The external evidence store and ledger are tamper-evident controls, not a
  complete cryptographic trust boundary.
- Limited hard-gate artifacts define protected-boundary policy only. They do
  not authorize broad hard-gating of ordinary local editing.

## Current Risk Areas

- Proof-surface matching still needs continued adversarial coverage as new false
  positives or false negatives are observed in attached repos.
- Unusual repository shapes may need additional proof-surface discovery fixtures.
- Attached-repo status can lag current repo state; `stax:status` now labels
  stored status as last-known and points users to `stax:gate` for current proof.
- Attached repos need their sidecars upgraded/exported only when the target repo
  is current and idle.
- Complexity debt remains: internal scripts, research artifacts, and historical
  release/campaign material still exist in the repo and are intentionally not
  part of the narrow public product surface.

## Worktree And Evidence Edge Cases

The current worktree fingerprint and command evidence verification are materially
stronger than earlier versions, but rollout evidence should still watch for:

- symlink behavior
- submodules
- Git LFS files
- file mode changes
- case-insensitive filesystem edge cases
- line-ending drift
- nested repositories

## Rollout Boundary

The deterministic rollout phase gate currently passes for the tracked phase
artifacts, but that is not a license to broaden the product claim.

The current allowed claim remains:

```txt
STAX is a scoped 9.5 local proof gate for Dean's Codex/repo project-control workflow.
```

Blocked claims remain blocked:

```txt
broad ChatGPT superiority
production-ready autonomous agent
arbitrary-domain reasoning superiority
real repo auto-apply
git push / deploy / publish authority
code correctness proof
```
