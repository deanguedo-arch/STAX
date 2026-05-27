# Pattern Promotion Impact Report

Generated: 2026-05-27T16:06:32.756Z

## Claim Separation

- Locked replay: Locked replay proves whether STAX behavior changed on frozen prompts and evidence.
- Current operating window: Current operating-window evidence proves whether STAX helps live repos today.
- These claims are intentionally separate. Locked replay does not prove live repo usefulness, and imported live evidence does not prove deterministic replay behavior.

## Locked Replay

Status: 10 cases, 0 critical misses
Improved: 8
Unchanged-safe: 2
Regressed: 0

### Locked Cases

- locked_codex_handoff_contract: improved; codex_handoff_rule -> review_for_promotion / mode_contract_patch; failures: none
- locked_schema_contract_rejects_malformed: improved; schema_contract_rule -> review_for_promotion / schema_patch; failures: none
- locked_wrong_repo_command_boundary: improved; proof_boundary_rule -> review_for_promotion / eval; failures: none
- locked_seed_gold_not_repair_proof: improved; proof_boundary_rule -> review_for_promotion / eval; failures: none
- locked_visual_diff_not_visual_proof: improved; mode_behavior_rule -> review_for_promotion / mode_contract_patch; failures: none
- locked_publish_sync_requires_preflight: improved; policy_safety_rule -> review_for_promotion / policy_patch; failures: none
- locked_missing_specificity_reports: improved; cross_repo_pattern -> review_for_promotion / eval; failures: none
- locked_explicit_user_preference_only: improved; user_preference -> review_for_promotion / memory; failures: none
- locked_repo_specific_fact_stays_local: unchanged_safe; repo_specific_fact -> hold_local / none; failures: none
- locked_one_off_command_failure_trace_only: unchanged_safe; trace_fact -> discard / none; failures: none

## Current Operating Window Imports

Status: 3 imported bundle(s), 0 critical miss(es)
Full handoff contracts: 2/3
Proof artifacts requested: 3/3
Cleanup prompts needed: 3/3

### Imported Bundles

- STAX: improved; commands=212; artifacts=5; failures: none
- canvas-helper: improved; commands=43; artifacts=9; failures: none
- ADMISSION-APP: unchanged_safe; commands=0; artifacts=6; failures: full handoff contract missing

## Boundary

This report does not inspect or mutate attached repos. Current operating-window claims require imported evidence bundles exported from the machine that has those repos.
