# RAX Behavior Contract Triage Report

Date: 2026-04-27

Status: implemented.

## Summary

After behavior mining saturated, Red Team, Blue Team, and the external STAX
planning chat converged on the same risk: do not implement 145 mined
requirements directly.

This patch adds two bounded consensus slices:

1. candidate-only behavior requirement triage
2. a minimal Evidence-to-Decision Gate

Together they turn mined behavior into deduplicated, grouped, risk-aware
implementation pressure while preventing weak evidence from becoming verified
claims.

## Scope

Implemented:

- candidate-only behavior requirement triage
- minimal evidence decision classification
- grouped dispositions
- missing artifact detection
- next-slice selection
- CLI and chat surfaces
- tests and regression eval

Not implemented:

- promotion of evals, memory, training data, policies, schemas, or modes
- autonomous agents
- direct source patches from mined candidates
- broad Evidence-to-Decision Gate behavior across all STAX answers

## Files Created

- `src/compare/BehaviorRequirementTriage.ts`
- `src/audit/EvidenceDecisionGate.ts`
- `evals/regression/behavior_mining_candidate_only_no_promotion.json`
- `evals/regression/evidence_decision_no_local_proof.json`
- `evals/regression/evidence_decision_pasted_test_claim.json`
- `evals/regression/evidence_decision_local_trace_eval.json`
- `docs/RAX_BEHAVIOR_CONTRACT_TRIAGE_REPORT.md`

## Files Modified

- `src/cli.ts`
- `src/chat/ChatSession.ts`
- `src/agents/AnalystAgent.ts`
- `src/audit/EvidenceSufficiencyScorer.ts`
- `src/audit/VerifiedAuditContract.ts`
- `src/evaluators/PropertyEvaluator.ts`
- `src/schemas/CodexAuditOutput.ts`
- `src/schemas/ModelComparisonOutput.ts`
- `src/validators/CodexAuditValidator.ts`
- `src/validators/ModelComparisonValidator.ts`
- `tests/behaviorMining.test.ts`
- `tests/chatSession.test.ts`
- `tests/evidenceDecisionGate.test.ts`
- `tests/localProofSuperiority.test.ts`

## Triage Dispositions

```txt
reject_noise
needs_human_review
eval_candidate_seed
proof_receipt_candidate
workspace_audit_candidate
codex_handoff_candidate
safety_redteam_candidate
```

All records are marked:

```txt
promotionBoundary: candidate_only
```

## Status Rules

Only `new_candidate` mined requirements are triaged.

Triage may classify a mined item as:

- noise-like
- proof candidate
- workspace audit candidate
- eval seed
- Codex handoff candidate
- safety redteam candidate
- human review item

Triage does not promote anything.

## Next Slice Selection

The current top implementation slice is:

```txt
Evidence-to-Decision Gate
```

Reason:

The mined requirements are dominated by proof/evidence behavior. The next actual
behavior implementation should stop weak, pasted, stale, missing, or conflicting
evidence from becoming verified claims.

## Minimal Evidence-to-Decision Gate

The gate classifies supplied evidence into:

```txt
local_command
local_trace
local_eval
local_file
ci
pasted_human
inferred
missing
```

It produces one decision:

```txt
verified
partial
reasoned_opinion
blocked_for_evidence
```

Rules:

- pasted claims are not local command evidence
- file paths alone are partial, not verified
- verified requires local command/eval/trace evidence tied to the claim
- conflicting pass/fail evidence blocks verified status

The gate is wired only into:

- `codex_audit`
- `model_comparison`

It is not a full runtime-wide proof system.

## Commands Added

```bash
npm run rax -- mine triage
npm run rax -- mine triage --write
npm run rax -- mine next
```

Chat:

```txt
/mine triage
/mine next
```

## Proof No Promotion Or Runtime Mutation Occurred

The triage command is dry-run by default.

When `--write` is supplied, it writes only:

```txt
learning/extraction/triage/latest.json
```

It does not write to:

- `memory/approved`
- `evals/regression` from mined candidates
- `training/exports`
- policies
- schemas
- modes
- source patches

## Tests Added

- triage mined requirements as candidate-only implementation units
- reject noise-like mined candidates
- flag missing artifact suggestions
- dry-run by default
- write only when requested
- chat `/mine triage` does not promote memory
- pasted test claims are not verified local command evidence
- file path evidence is partial only
- local command/eval/trace evidence can verify a scoped claim
- conflicting evidence blocks verification

## Regression Eval Added

- `behavior_mining_candidate_only_no_promotion`
- `evidence_decision_no_local_proof`
- `evidence_decision_pasted_test_claim`
- `evidence_decision_local_trace_eval`

## Command Results

```txt
npm run typecheck: passed
npm test: 46 files / 182 tests passed
npm run rax -- mine triage --limit 8: passed
npm run rax -- mine next --limit 5: passed
npm run rax -- mine triage --write --limit 5: passed
npm run rax -- eval: 16/16 passed
npm run rax -- eval --regression: 43/43 passed
npm run rax -- eval --redteam: 9/9 passed
```

Smoke evidence:

```txt
codex_audit pasted-test claim:
- Audit Type: Reasoned Opinion
- Evidence Decision: reasoned_opinion
- Evidence Classes: pasted_human, missing
- Approval Recommendation: Reject until evidence is supplied.

model_comparison with no local proof:
- Evidence Decision: reasoned_opinion
- Evidence Classes: missing
```

## Red / Blue Consensus

Red Team warning:

```txt
Do not implement the 145 mined requirements directly.
```

Blue Team target:

```txt
Evidence-to-Decision Gate is the highest-value next behavior slice.
```

Consensus implementation:

```txt
Build behavior triage plus the minimal Evidence-to-Decision Gate now.
Defer the full proof system and the remaining mined requirements.
```

## Remaining Limitations

- Triage is deterministic and keyword-based.
- The Evidence-to-Decision Gate is deliberately narrow and only wired to audit
  and model-comparison output.
- The remaining mined requirements are triaged, not implemented.
