# STAX Dogfood Regression Additions

Generated: 2026-05-12T12:25:40.632Z

- phase2_bootstrap_002_phase1_fixture_league: Added tests/staxTrialLeague.test.ts to gate false accepts, false rejects, actionability, and artifact alignment.
- phase2_observer_001_canvas_helper_command_audit: Added command classifier coverage for npm run test:* package scripts.
- phase2_observer_001_canvas_helper_command_audit: Added claim-decomposition coverage so command script names do not become config or policy claims.
- phase2_observer_001_canvas_helper_command_audit: Added proof-stack coverage for selecting relevant command evidence from mixed local command sets.
- phase2_observer_002_stax_self_sidecar_audit: Updated dogfood league tests so missing run count remains in_progress while quality failures still fail.
- phase2_observer_003_stax_sidecar_refresh_command: Added sidecar refresh coverage proving heartbeat and current-turn artifacts are written together from a Codex session fixture.
- phase2_observer_004_phase3_claim_extraction_hardening: Added tests/claimExtractionHardening.test.ts to enforce 100 claim-evasion fixtures, zero high-risk false negatives, false-positive control, unsupported-accept control, and phrasing documentation.
- phase2_observer_004_phase3_claim_extraction_hardening: Kept sidecar attach/gate regression coverage green after narrowing the data detector.
- phase2_observer_005_rollout_phase_gate: Added tests/rolloutPhaseGate.test.ts to prove Phase 0, Phase 1, and Phase 3 pass while Phase 2 remains in progress and later phases stay blocked.
- phase2_observer_006_product_surface_map: Kept tests/rolloutPhaseGate.test.ts green after changing public-surface evaluation.
- phase2_observer_008_soft_gate_trial_artifacts: Added tests/staxSoftGateTrial.test.ts to enforce Phase 4 trial metrics and hard-gate activation boundary wording.
- phase2_observer_011_rollout_gate_pass_marker_hardening: Kept tests/rolloutPhaseGate.test.ts green after adding explicit pass-marker checks.
- phase2_observer_012_command_risk_policy_tests: Added tests/commandRiskPolicy.test.ts for command-risk classification coverage.
- phase2_observer_013_preflight_approval_tests: Added tests/preflightApproval.test.ts for scoped approval validation.
- phase2_observer_014_product_surface_artifact_tests: Added tests/productSurfaceArtifacts.test.ts for public/internal command classification.
- phase2_observer_015_limited_hard_gate_policy_tests: Added tests/limitedHardGatePolicy.test.ts for hard-gate policy scope.
- phase2_observer_016_soft_gate_negative_controls: Expanded tests/staxSoftGateTrial.test.ts with Phase 4 negative controls.
- phase2_observer_017_dogfood_ledger_integrity_tests: Added tests/dogfoodLedgerIntegrity.test.ts for observer ledger hygiene.
- phase2_observer_018_rollout_artifact_sync_tests: Added tests/rolloutPhaseArtifacts.test.ts for rollout status/report alignment.
