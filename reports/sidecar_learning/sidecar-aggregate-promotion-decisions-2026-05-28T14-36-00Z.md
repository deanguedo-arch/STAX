# Sidecar Aggregate Promotion Decisions

Generated: 2026-05-28T14:36:00.000Z

Source aggregate report:

- `reports/sidecar_learning/sidecar-import-aggregation-2026-05-28T14-03-55-877Z.json`

## Promoted Narrowly

### agg_proof_boundary_rule

- Decision: promote narrowly
- Queue: `eval_candidate`
- Target: `eval`
- Source candidates: 15
- Artifact: `evals/candidates/agg_proof_boundary_rule.json`
- Regression eval: `evals/regression/wrong_repo_proof_boundary.json`

Promoted only the reusable target-repo command-proof boundary:

- command evidence can verify a claim only when it matches the target repo, cwd, branch, commit, and current auditable worktree
- wrong-repo, wrong-cwd, wrong-branch, wrong-commit, wrong-worktree, stale, human-pasted, or Codex-reported command evidence cannot become strong local proof
- the correction path is fresh STAX-collected command evidence from the target repo

Regression/evidence backing:

- `evals/regression/wrong_repo_proof_boundary.json`
- `fixtures/pattern_promotion/locked_replay_10_cases.json#locked_wrong_repo_command_boundary`
- `fixtures/command_evidence/command_evidence_core_cases.json`
- `tests/commandEvidenceIntelligence.test.ts`
- `tests/proofStrengthGate.test.ts`
- `docs/RAX_OPERATING_WINDOW_TODAY_REPORT.md`

Not promoted:

- Canvas-specific course names
- Brightspace-specific quiz names
- local paths beyond generic target-repo/cwd concepts
- one-off branch names
- raw Codex report wording

## Next Review

### agg_policy_safety_rule

- Decision: next review
- Queue if approved: `policy_patch_candidate`
- Target if approved: `policy_patch`
- Reason: publish/sync/deploy safety rules are the next highest-priority aggregate after proof-boundary promotion.

## Held

### agg_schema_contract_rule

- Decision: hold for reconciliation
- Queue if approved: `schema_patch_candidate`
- Target if approved: `schema_patch`
- Reason: an earlier schema-contract aggregate was already promoted. Reconcile before adding another.

## Already Promoted

### agg_codex_handoff_rule

- Existing artifact: `learning/proposals/mode_contract_patch_candidates/agg_codex_handoff_rule.json`

### agg_mode_behavior_rule

- Existing artifact: `learning/proposals/mode_contract_patch_candidates/agg_mode_behavior_rule.json`
