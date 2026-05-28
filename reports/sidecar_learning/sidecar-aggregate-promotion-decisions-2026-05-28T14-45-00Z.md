# Sidecar Aggregate Promotion Decisions

Generated: 2026-05-28T14:45:00.000Z

Source aggregate report:

- `reports/sidecar_learning/sidecar-import-aggregation-2026-05-28T14-03-55-877Z.json`

## Promoted Narrowly

### agg_policy_safety_rule

- Decision: promote narrowly
- Queue: `policy_patch_candidate`
- Target: `policy_patch`
- Source candidates: 12
- Artifact: `learning/proposals/policy_patch_candidates/agg_policy_safety_rule.json`
- Regression eval: `evals/regression/publish_sync_requires_preflight.json`

Promoted only the reusable publish/sync/deploy/release safety boundary:

- publish, sync, deploy, release, push, and data-publish requests require non-mutating preflight and target validation before readiness claims
- live action requires explicit human approval and rollback or revert framing
- without that proof, STAX must block or downgrade the request to a bounded preflight-only next action

Regression/evidence backing:

- `evals/regression/publish_sync_requires_preflight.json`
- `fixtures/pattern_promotion/locked_replay_10_cases.json#locked_publish_sync_requires_preflight`
- `fixtures/release_gate_proof/release_gate_proof_core_cases.json`
- `tests/releaseGateAnalyzer.test.ts`
- `tests/preflightApproval.test.ts`
- `docs/RAX_OPERATING_WINDOW_TODAY_REPORT.md`

Not promoted:

- Canvas-specific course names
- Firebase project names
- live URLs
- local deploy scripts beyond generic action classes
- one-off task facts
- raw Codex report wording

## Already Promoted

### agg_schema_contract_rule

- Existing artifact: `learning/proposals/schema_patch_candidates/agg_schema_contract_rule.json`

### agg_codex_handoff_rule

- Existing artifact: `learning/proposals/mode_contract_patch_candidates/agg_codex_handoff_rule.json`

### agg_mode_behavior_rule

- Existing artifact: `learning/proposals/mode_contract_patch_candidates/agg_mode_behavior_rule.json`

### agg_proof_boundary_rule

- Existing artifact: `evals/candidates/agg_proof_boundary_rule.json`

## Not Promoted

### agg_repo_specific_fact

- Decision: keep local trace only
- Reason: repo-specific facts remain sidecar evidence only.

### agg_trace_fact

- Decision: discard or keep trace only
- Reason: one-off observations should not become durable learning.
