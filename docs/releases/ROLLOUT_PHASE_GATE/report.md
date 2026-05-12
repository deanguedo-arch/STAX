# STAX Rollout Phase Gate

Generated: 2026-05-12T15:22:34.724Z

## Summary

```txt
Status: passed
Next action: All rollout phases have passed their deterministic gates.
```

## Phase Status

### Phase 0 - Lock Current Proof Baseline

```txt
Phase: phase_0_baseline
Status: passed
Score target: Baseline validation commands pass and known limits are explicit.
Promotion gate passed: true
```

Proof artifacts:

- docs/releases/STAX_RC_CURRENT/command_proof.md
- docs/releases/STAX_RC_CURRENT/known_limits.md
- docs/releases/STAX_RC_CURRENT/allowed_claims.md
- docs/releases/STAX_RC_CURRENT/forbidden_claims.md

Gate findings:

- No gate failures recorded.

Next action: Keep this baseline immutable unless a new baseline proof packet is generated.

### Phase 1 - Adversarial Fixture League

```txt
Phase: phase_1_fixture_league
Status: passed
Score target: 50 fixtures, 0 critical false accepts, <=5% false rejects, >=90% actionable next prompts.
Promotion gate passed: true
```

Proof artifacts:

- fixtures/stax_trials/manifest.json
- fixtures/stax_trials/results.json
- fixtures/stax_trials/failure_report.md

Gate findings:

- No gate failures recorded.

Next action: Keep fixture failures converted into regression cases before broad rollout.

### Phase 2 - STAX Self-Dogfood League

```txt
Phase: phase_2_dogfood_league
Status: passed
Score target: 20 eligible observer runs, 0 critical false accepts, <=10% false rejects, >=90% protocol and next-prompt rates.
Promotion gate passed: true
```

Proof artifacts:

- docs/releases/STAX_DOGFOOD_LEAGUE/observer_runs.json
- docs/releases/STAX_DOGFOOD_LEAGUE/observer_report.md
- docs/releases/STAX_DOGFOOD_LEAGUE/regression_additions.md

Gate findings:

- No gate failures recorded.

Next action: Proceed to measured soft-gate trial only after misses are in regression tests.

### Phase 3 - Claim Extraction Hardening

```txt
Phase: phase_3_claim_extraction
Status: passed
Score target: 100 claim-evasion fixtures, 0 high-risk false negatives, <=10% false positives, 0 unsupported accepts.
Promotion gate passed: true
```

Proof artifacts:

- fixtures/stax_trials/claim_evasion_results.json
- docs/releases/CLAIM_EXTRACTION_HARDENING/report.md
- docs/releases/CLAIM_EXTRACTION_HARDENING/allowed_phrasing.md

Gate findings:

- No gate failures recorded.

Next action: Use Phase 3 as a prerequisite for soft-gate trials.

### Phase 4 - Soft-Gate Trial

```txt
Phase: phase_4_soft_gate_trial
Status: passed
Score target: 50 soft-gate runs, 0 high-risk false accepts, <=5% false rejects for build/test/typecheck, <=20% overrides.
Promotion gate passed: true
```

Proof artifacts:

- docs/releases/SOFT_GATE_TRIAL/runs.json
- docs/releases/SOFT_GATE_TRIAL/override_ledger.json
- docs/releases/SOFT_GATE_TRIAL/trial_report.md

Gate findings:

- No gate failures recorded.

Next action: Finish the dogfood league, then run measured soft-gate trials with an override ledger.

### Phase 5 - Product Surface Amputation

```txt
Phase: phase_5_product_surface
Status: passed
Score target: Public surface <=6 commands and cold-user demo/docs prove the narrowed product story.
Promotion gate passed: true
```

Proof artifacts:

- docs/releases/PRODUCT_SURFACE_AMPUTATION/demo_checklist.md
- docs/releases/PRODUCT_SURFACE_AMPUTATION/public_surface_map.md
- docs/releases/PRODUCT_SURFACE_AMPUTATION/archive_map.md

Gate findings:

- No gate failures recorded.

Next action: Map public/internal/archive commands, then shrink the visible product path without deleting internal capability.

### Phase 6 - Limited Hard Gate

```txt
Phase: phase_6_limited_hard_gate
Status: passed
Score target: Hard gate only protected boundaries after 50+ soft-gate runs across 3+ repos.
Promotion gate passed: true
```

Proof artifacts:

- docs/releases/LIMITED_HARD_GATE/boundary_policy.md
- docs/releases/LIMITED_HARD_GATE/override_policy.md
- docs/releases/LIMITED_HARD_GATE/rollback_proof.md
- docs/releases/LIMITED_HARD_GATE/trial_report.md
- docs/releases/LIMITED_HARD_GATE/release_like_preflight_trial.md

Gate findings:

- No gate failures recorded.

Next action: Do not turn on hard gate until soft-gate trial evidence and boundary policies pass.

