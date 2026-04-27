# RAX Review Router Report

Status: implemented and validated.

## Scope

Added a risk-based Review Router that triages generated learning, lab, patch, handoff, evidence, and correction artifacts into:

- auto_archive
- auto_candidate
- auto_stage_for_review
- batch_review
- human_review
- hard_block

The router is metadata-only. It does not approve or promote artifacts.

## Files Created

- src/review/ReviewSchemas.ts
- src/review/ReviewRiskScorer.ts
- src/review/ReviewLedger.ts
- src/review/ReviewQueue.ts
- src/review/ReviewStats.ts
- src/review/ReviewBatcher.ts
- src/review/ReviewRouter.ts
- tests/reviewRouter.test.ts
- docs/STAX_REVIEW_ROUTER.md
- docs/RAX_REVIEW_ROUTER_REPORT.md
- review/.gitkeep

## Files Modified

- .gitignore
- src/agents/AnalystAgent.ts
- src/chat/ChatSession.ts
- src/cli.ts
- src/learning/LearningMetrics.ts
- src/learning/LearningRecorder.ts
- src/safety/BoundaryDecision.ts
- src/safety/RiskClassifier.ts
- tests/behavior100Proof.test.ts
- tests/redteamEval.test.ts

## Regression Evals Added

- evals/regression/review_router_policy_drift_self_approval.json
- evals/regression/review_router_learning_unit_no_auto_promotion.json
- evals/regression/review_router_prompt_factory_bounded.json
- evals/regression/review_router_planning_evidence_gate.json
- evals/regression/review_router_codex_audit_defensive_plan.json
- evals/regression/review_router_codex_audit_actionable_bypass_refused.json

## Approval Boundary

No review command approves or promotes memory, evals, training records, policies, schemas, modes, config, AGENTS.md, source patches, or external repo writes.

## Command Results

- `npm run typecheck`: passed.
- `npm test`: 42 files / 153 tests passed.
- `npm run rax -- eval`: 16/16 passed, 0 critical failures.
- `npm run rax -- eval --regression`: 34/34 passed, 0 critical failures.
- `npm run rax -- eval --redteam`: 9/9 passed, 0 critical failures.
- `npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes." --print summary`: mode `stax_fitness`, validation passed.
- `npm run rax -- review route <learning-event-path>`: dry-run route produced review metadata without applying it.
- `npm run rax -- review inbox`: surfaced hard-block/human-review items and hid trace-only noise.
- `npm run rax -- review staged`: showed auto-staged low-risk items.
- `npm run rax -- review stats`: wrote review stats with disposition/risk/state counts.
- `npm run rax -- chat --once "/review staged"`: returned dry-run staged review items; chat did not persist review metadata.

## Proof No Auto-Promotion Occurred

- Unit tests assert auto-staged items write only under `review/staged/`.
- Unit tests assert no `evals/regression/`, `memory/approved/`, `training/exports/`, or `goldens/` directories are created by auto-stage routing.
- Chat `/review` is read-only and dry-run only.
- CLI review commands include archive/reject/escalate metadata transitions, but no approve/promote command exists.
- Existing PromotionGate remains the only route for durable promotion.

## Sample Review Metrics

Latest smoke output:

```json
{
  "total": 255,
  "byDisposition": {
    "auto_candidate": 3,
    "auto_stage_for_review": 239,
    "hard_block": 11,
    "human_review": 2
  },
  "byRisk": {
    "low": 242,
    "critical": 11,
    "high": 2
  }
}
```

## Remaining Limitations

- Review refresh intentionally skips trace-only LearningEvents by default to avoid turning historical run noise into an inbox.
- Chat review commands cannot approve, reject, archive, or escalate yet.
- `auto_stage_for_review` is metadata staging only; staged artifacts are not active evals, memory, training data, schemas, policies, modes, or patches.
