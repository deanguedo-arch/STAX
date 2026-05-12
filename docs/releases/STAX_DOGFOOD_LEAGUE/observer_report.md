# STAX Dogfood Observer Report

Generated: 2026-05-12T12:25:40.632Z

## Summary

```txt
League: stax_dogfood_observer_v1
Status: passed
Total runs: 23
Eligible observer runs: 20
Bootstrap observations: 3
Critical false accepts: 0
False rejects: 0
False reject rate: 0
Protocol compliance rate: 1
Next prompt actionable rate: 1
Bypass rate: 0
Promotion gate passed: true
```

## Gate Findings

- Phase 2 promotion gate passed.

## Runs

- phase2_bootstrap_001_rollout_baseline: bootstrap_observation, Accept, human=accepted, counts=false
- phase2_bootstrap_002_phase1_fixture_league: bootstrap_observation, Accept, human=accepted, counts=false
- phase2_bootstrap_003_trial_runner: bootstrap_observation, Accept, human=accepted_after_fix, counts=false
- phase2_observer_001_canvas_helper_command_audit: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_002_stax_self_sidecar_audit: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_003_stax_sidecar_refresh_command: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_004_phase3_claim_extraction_hardening: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_005_rollout_phase_gate: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_006_product_surface_map: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_007_limited_hard_gate_policy_docs: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_008_soft_gate_trial_artifacts: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_009_product_surface_demo_proof: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_010_limited_hard_gate_trial_proof: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_011_rollout_gate_pass_marker_hardening: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_012_command_risk_policy_tests: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_013_preflight_approval_tests: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_014_product_surface_artifact_tests: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_015_limited_hard_gate_policy_tests: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_016_soft_gate_negative_controls: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_017_dogfood_ledger_integrity_tests: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_018_rollout_artifact_sync_tests: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_019_rollout_guardrail_test_sweep: observer, Accept, human=not_reviewed, counts=true
- phase2_observer_020_phase2_exit_gate_check: observer, Accept, human=not_reviewed, counts=true

## Workflow Burden Findings

- Remote main moved during push; the process needed a fetch and rebase before push.
- Mixed command evidence initially selected an irrelevant test command for a build-scoped classifier pass.
- Every gate writes a new turn contract, so manual observer runs need a smoother acknowledgement refresh loop.
- The self-gate required exact current STAX acknowledgement text to appear in captured conversation messages, not only in tool output.
- The repo has a watcher script but no package script alias for a one-shot sidecar heartbeat and turn capture refresh.
- A one-shot sidecar refresh command reduces manual heartbeat/current-turn capture setup, but the exact acknowledgement still must appear in captured conversation before strict gate acceptance.
- Full-suite validation caught a too-broad data detector that focused Phase 3 fixtures did not expose.
- The rollout needed a deterministic phase gate because chat-level phase status was too easy to overstate.

## Debloat Findings

- Rollout review needed a single doc instead of chat-only phase planning.
- Phase 1 surfaced that proof fixtures need a regeneration command, not hand-maintained JSON.
- The npm script drawer is still large; phase-specific proof scripts should be marked internal during product-surface amputation.
- Canvas Helper has many safe local test scripts but no single canonical observer audit script.
- Sidecar report wording with slash-like phrases can create bogus file-path claims.
- Self-attach adds a marked STAX section to AGENTS.md; reviewers should decide whether STAX itself keeps that public sidecar surface committed.
- The sidecar freshness workflow needs a simpler public command before wider observer rollout.
- The refresh command improves operator ergonomics, but product-surface amputation still needs a decision on whether it is public, internal, or folded into preflight.
- The Phase 3 runner is useful for rollout evidence but should be classified internal during product-surface amputation.
- The phase gate exposes that the visible STAX npm script surface is still too large and needs Phase 5 classification.
- Public docs now expose six STAX commands while internal npm helpers are classified separately.
- Hard-gate policy is documented as boundary infrastructure, not the day-to-day public product path.
- The soft-gate trial runner is rollout infrastructure and should remain internal.
- The product demo now proves the six-command story without needing historical campaign context.
- Limited hard gate remains framed as protected-boundary infrastructure, not a general user workflow.
- Phase-gate pass markers prevent placeholder docs from masquerading as completed surface cleanup.
- Public surface artifacts now have direct regression coverage.
