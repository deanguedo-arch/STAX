# Sidecar Aggregate Promotion Decisions

Generated: 2026-05-08T18:08:24.709Z

Source aggregate report:

- `reports/sidecar_learning/sidecar-import-aggregation-2026-05-08T17-20-03-274Z.md`

## Promoted

### agg_codex_handoff_rule

- Decision: promote
- Queue: `codex_prompt_candidate`
- Target: `mode_contract_patch`
- Source candidates: 29
- Artifact: `learning/proposals/mode_contract_patch_candidates/agg_codex_handoff_rule.json`

Promoted only the reusable bounded handoff structure:

- exact repo/workspace path
- current task objective
- files or surfaces to inspect
- allowed commands
- forbidden commands/actions
- acceptance criteria
- stop condition
- required evidence to return

Not promoted:

- Brightspace-specific file names
- question numbers
- branch names
- live URLs
- one-off task facts

### agg_schema_contract_rule

- Decision: promote narrowly
- Queue: `schema_patch_candidate`
- Target: `schema_patch`
- Source candidates: 6
- Artifact: `learning/proposals/schema_patch_candidates/agg_schema_contract_rule.json`

Promoted only the reusable contract:

- external/import/render/live-form success requires an explicit proof artifact
- required proof must identify artifact path or URL
- required proof must identify inspection target
- required proof must state required checks
- required proof must state pass/fail status
- required proof must state unverified remainder
- required proof must include a stop condition

Not promoted:

- specific Math 30 question IDs
- temporary file paths
- live form URLs
- one-off batch details

## Held

### agg_proof_boundary_rule

- Decision: hold for source review
- Queue if later approved: `eval_candidate`
- Target if later approved: `eval`
- Reason: aggregate label and suggested eval are valuable, but current examples do not clearly prove the exact wrong-repo command-evidence rule.

Required before promotion:

- inspect the 5 source candidates
- confirm they truly support target-repo proof-boundary behavior
- split or reclassify the aggregate if evidence is mixed
- then promote an eval for: command output from repo A must not verify repo B

## Not Promoted

### agg_repo_specific_fact

- Decision: keep trace-only
- Reason: repo-specific Math 30/Brightspace facts are evidence, not durable learning.

### agg_trace_fact

- Decision: keep trace-only
- Reason: one-off observation.
