# Sidecar Aggregate Promotion Decisions

Generated: 2026-05-28T14:24:35.000Z

Source aggregate report:

- `reports/sidecar_learning/sidecar-import-aggregation-2026-05-28T14-03-55-877Z.json`

## Promoted Narrowly

### agg_mode_behavior_rule

- Decision: promote narrowly
- Queue: `mode_contract_patch_candidate`
- Target: `mode_contract_patch`
- Source candidates: 2
- Artifact: `learning/proposals/mode_contract_patch_candidates/agg_mode_behavior_rule.json`

Promoted only the reusable visual-proof contract:

- visual, layout, and course-behavior completion claims require rendered screenshot, browser, or checklist proof
- source diffs, CSS diffs, ordinary command output, and prose do not prove visual behavior by themselves
- proof-rule wording about visual evidence is governance text, not a visual completion claim

Regression/evidence backing:

- `fixtures/pattern_promotion/locked_replay_10_cases.json#locked_visual_diff_not_visual_proof`
- `reports/pattern_promotion/pattern-promotion-impact-2026-05-28T12-15-17-138Z.json`
- `tests/proofStrengthGate.test.ts`
- `tests/sidecarClaimExtractionPrecision.test.ts`
- `tests/sidecarImportAggregation.test.ts`

Not promoted:

- Canvas Helper course names
- local screenshot filenames
- live URLs
- one-off deploy or course task facts
- raw Codex report wording

## Next Review

### agg_proof_boundary_rule

- Decision: next review
- Queue if approved: `eval_candidate`
- Target if approved: `eval`
- Reason: still needs source-candidate inspection and regression backing before promotion.

## Held

### agg_policy_safety_rule

- Decision: hold for source review
- Queue if approved: `policy_patch_candidate`
- Target if approved: `policy_patch`
- Reason: publish/sync/deploy safety rules are high value, but they must be split into narrow policy candidates with direct regression tests.

### agg_schema_contract_rule

- Decision: hold for reconciliation
- Queue if approved: `schema_patch_candidate`
- Target if approved: `schema_patch`
- Reason: an earlier schema-contract aggregate was already promoted. This batch should be reconciled with that artifact before adding another.

### agg_codex_handoff_rule

- Decision: already promoted
- Existing artifact: `learning/proposals/mode_contract_patch_candidates/agg_codex_handoff_rule.json`
- Reason: the reusable bounded handoff pattern already has a reviewed aggregate promotion artifact.

## Not Promoted

### agg_repo_specific_fact

- Decision: keep local trace only
- Reason: repo-specific facts are sidecar evidence, not durable global learning.

### agg_trace_fact

- Decision: discard or keep trace only
- Reason: one-off observations should not become durable learning.
