# Sidecar Raw Candidate Closure

Generated: 2026-05-28T15:12:00.000Z

Source aggregate report:

- `reports/sidecar_learning/sidecar-import-aggregation-2026-05-28T14-03-55-877Z.json`

## Decision

Close the 80 pending raw candidates covered by the reviewed aggregate report.

- 72 candidates moved from `queues/sidecar_imports/pending/` to `queues/sidecar_imports/promoted/`
- 8 candidates moved from `queues/sidecar_imports/pending/` to `queues/sidecar_imports/rejected/`

## Promoted Coverage

These aggregate groups have reviewed promotion artifacts:

- `agg_codex_handoff_rule`
- `agg_schema_contract_rule`
- `agg_mode_behavior_rule`
- `agg_proof_boundary_rule`
- `agg_policy_safety_rule`

## Deferred Coverage

These aggregate groups are not durable-learning material:

- `agg_repo_specific_fact`
- `agg_trace_fact`

They remain evidence only. They do not become global STAX behavior.

## Post-Closure Dashboard

```txt
Pending candidates: 0
Promoted candidates: 96
Rejected/deferred candidates: 9
Top aggregate recommendation: none
Recommended next action: No pending sidecar learning action.
```

## Not Promoted

- repo-specific facts
- one-off trace facts
- raw Codex report wording
- local attached-repo details

This closure is queue hygiene, not auto-promotion.
