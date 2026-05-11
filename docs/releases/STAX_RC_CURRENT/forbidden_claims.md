# STAX RC Current Forbidden Claims

These claims are not allowed for the current RC without additional proof.

## Product Overclaims

- STAX proves code correctness.
- STAX replaces human review.
- STAX is ready to hard-gate important repos by default.
- STAX is tamper-proof.
- STAX prevents all fake-complete claims.
- STAX proves general ChatGPT, Codex, or model superiority.
- STAX is a general AI operating system or ChatGPT competitor.

## Evidence Overclaims

- Codex-reported command output is strong proof by itself.
- A sidecar JSON field saying `local_stax_command_output` is enough to trust
  command evidence.
- Passing tests prove all behavior changed correctly.
- Local package generation proves live platform upload or deployment.
- A visual claim can be accepted without screenshot, rendered preview, or
  equivalent visual proof.
- A release/deploy claim can be accepted without release, environment, rollback,
  or preflight evidence.
- A security claim can be accepted without security-specific proof.

## Rollout Overclaims

- Observer-mode machinery is proven operationally mature across repos.
- Soft gate is ready for broad rollout.
- Hard gate is ready for local editing workflows.
- Product debloat is complete.
- Public v1 readiness is proven by the Phase 0 command packet alone.

## Scoring Boundary

Proof strength is not truth confidence.

Allowed:

```txt
Proof Strength: Strong because verified local command evidence matches the
audited worktree.
```

Forbidden:

```txt
Confidence: high that the code is correct.
```
