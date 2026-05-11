# RAX Pattern Promotion Gate Report

Date: 2026-05-08

Status: implemented.

## Problem Fixed

The sidecar can harvest useful real-work evidence from repos like `brightspacequizexporter`, but evidence is not the same thing as learning. A raw command result, one changed file, one failed test, or one Codex claim should stay trace evidence unless it exposes a reusable pattern.

The pattern promotion gate adds a reviewable classification layer between harvested sidecar evidence and durable STAX artifacts.

## Implemented

- `src/learning/PatternPromotionGate.ts`
- `src/learning/PatternPromotionSchemas.ts`
- `src/learning/SidecarImportAggregation.ts`
- `src/learning/SidecarImportReview.ts`
- `scripts/staxAggregateImports.ts`
- `tests/patternPromotionGate.test.ts`
- `tests/sidecarImportAggregation.test.ts`
- `tests/sidecarHarvestPromote.test.ts`
- Public exports from `src/index.ts`

## Classifications

The gate classifies candidates as:

- `trace_fact`
- `repo_specific_fact`
- `cross_repo_pattern`
- `proof_boundary_rule`
- `codex_handoff_rule`
- `mode_behavior_rule`
- `policy_safety_rule`
- `schema_contract_rule`
- `user_preference`

Only reusable behavior-changing classifications can be promotable. `trace_fact` and `repo_specific_fact` are never promoted beyond trace handling.

## Promotion Rules

- Single low-severity facts remain `trace_only`.
- Repo-specific file, package, command, and local-state facts remain trace evidence.
- Repeated missing-specificity failures become `eval_candidate`.
- Proof-boundary rules become `eval_candidate`.
- Visual proof rules become `mode_contract_patch_candidate`.
- Publish/sync/deploy safety rules become `policy_patch_candidate`.
- Schema contract weaknesses become `schema_patch_candidate`.
- Codex handoff patterns become `codex_prompt_candidate`.
- Durable user preferences can become `memory_candidate` only when explicitly supplied as preferences.
- Training promotion is not automatic and still requires separate explicit approval.

## Guardrails

- The gate never auto-promotes.
- Every decision sets `autoPromote: false`.
- Every decision sets `requiresHumanApproval: true`.
- Command output is treated as evidence, not memory.
- Codex report wording is treated as evidence, not authority.
- Memory is reserved for durable user/project preferences, not proof claims.

## Behavior Change

STAX now has a concrete way to ask:

```txt
Would this improve STAX on a future task from a different repo?
```

If the answer is no, the candidate stays trace-only. If the answer is yes, the gate recommends the appropriate queue and promotion target, plus required evidence, expected future behavior change, and a suggested regression eval where possible.

`stax:review-imports` now prints the pattern classification, promotability, recommended queue, promotion target, and reason for each pending sidecar import candidate. The review command still does not promote anything by itself.

`stax:aggregate-imports` now groups pending sidecar import candidates by reusable pattern classification. This lets repeated one-off evidence become a reviewable aggregate recommendation without approving or promoting it.

## Validation

Focused validation:

```bash
npm test -- tests/patternPromotionGate.test.ts
```

Required repo validation:

```bash
npm run typecheck
npm test
npm run smoke:stax
npm run rax -- eval
```
