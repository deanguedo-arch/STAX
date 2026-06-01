# STAX RC Current Known Limits

This file defines what the current RC does not yet prove. These limits are part
of the Phase 0 baseline and should not be softened without new command proof,
fixtures, rollout data, or human approval.

## Operational Limits

- STAX is credible enough for dogfooding and observer-mode trials.
- STAX is not yet proven enough to hard-gate important repositories by default.
- `Accept` means required claims are supported by verified evidence for the
  audited repo state. It does not mean the code is generally correct.
- Local command evidence is stronger than Codex-reported evidence, but it is not
  a guarantee against a privileged local adversary.
- The external evidence store and ledger are tamper-evident controls, not a
  complete cryptographic trust boundary.

## Current Risk Areas

- Claim extraction and wording evasion remain a major hardening target.
- Unsupported or partially supported claim types must not produce `Accept`.
- Visual, release, security, data, and approval claims require their own proof
  classes before they can be accepted.
- Observer and soft-gate rollout data is not yet large enough to justify broad
  hard-gate enforcement.
- Product debloat remains incomplete: internal scripts, research artifacts, and
  historical release/campaign material still exist in the repo.

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

The next validated step is not hard gate. The next step is:

```txt
adversarial fixture league -> STAX observer dogfood -> claim extraction hardening -> soft-gate trial
```
