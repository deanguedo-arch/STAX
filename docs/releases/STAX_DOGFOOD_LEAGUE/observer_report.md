# STAX Dogfood Observer Report

Generated: 2026-05-12T01:44:09.699Z

## Summary

```txt
League: stax_dogfood_observer_v1
Status: in_progress
Total runs: 3
Eligible observer runs: 0
Bootstrap observations: 3
Critical false accepts: 0
False rejects: 0
False reject rate: 0
Protocol compliance rate: 0
Next prompt actionable rate: 0
Bypass rate: 0
Promotion gate passed: false
```

## Gate Findings

- Needs 20 eligible observer runs; currently has 0.

## Runs

- phase2_bootstrap_001_rollout_baseline: bootstrap_observation, Accept, human=accepted, counts=false
- phase2_bootstrap_002_phase1_fixture_league: bootstrap_observation, Accept, human=accepted, counts=false
- phase2_bootstrap_003_trial_runner: bootstrap_observation, Accept, human=accepted_after_fix, counts=false

## Workflow Burden Findings

- Remote main moved during push; the process needed a fetch and rebase before push.

## Debloat Findings

- Rollout review needed a single doc instead of chat-only phase planning.
- Phase 1 surfaced that proof fixtures need a regeneration command, not hand-maintained JSON.
- The npm script drawer is still large; phase-specific proof scripts should be marked internal during product-surface amputation.
