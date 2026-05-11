# Brightspace Promotion Shortlist

Generated: 2026-05-11
Source queue: `queues/sidecar_imports/pending`
Source repo: `brightspacequizexporter`
Reviewer: Codex
Status: shortlist only, not promoted

## Recommended For Promotion

### `cand_brightspacequizexporter_codex_report_fe172119557e`

- Classification: `schema_contract_rule`
- Target: `schema_patch`
- Why:
  - Fixes a reusable export-contract bug where UUID-like source identifiers leaked into question numbering.
  - Backed by source changes in `src/ingest/msforms/questionBank.ts`.
  - Backed by a regression test in `src/test/unit/ingest/msFormsQuestionBank.test.ts`.
  - Backed by a real smoke conversion run.
- Promotion intent:
  - Preserve the rule that exported question numbering must use deliberate question-number ids or sequential fallback, never arbitrary UUID fragments.

### `cand_brightspacequizexporter_codex_report_76a2d3d9282d`

- Classification: `schema_contract_rule`
- Target: `schema_patch`
- Why:
  - Captures reusable renderer/normalization hardening in the QTI visual proof pipeline.
  - Backed by script changes and test coverage for WIRIS cleanup, MathML normalization, and browser prompt preparation.
  - Generalizes beyond a single course batch.
- Promotion intent:
  - Preserve the contract that cartridge-derived visual prompts must normalize math markup into a stable, renderable proof path.

### `cand_brightspacequizexporter_codex_report_175327f3dbb2`

- Classification: `codex_handoff_rule`
- Target: `mode_contract_patch`
- Why:
  - Strong representative for the math-heavy visual-proof route with rendered prompt images plus real answer controls.
  - Backed by code changes, tests, and a real run.
  - Cleaner canonical example than the other near-duplicate QTI visual candidates.
- Promotion intent:
  - Preserve the workflow rule that math-heavy prompt fidelity may require rendered visual proof while retaining native answer controls.

### `cand_brightspacequizexporter_codex_report_3176c45528d1`

- Classification: `proof_boundary_rule`
- Target: `eval`
- Why:
  - Best candidate for turning the QTI visual export workflow into a reusable proof-boundary eval/runbook.
  - Valuable as a repeatable audit/check pattern instead of another repo memory fragment.
- Promotion intent:
  - Preserve the rule that real visual-export workflows should be documented and replayable as proof, not treated as one-off operator lore.

## Review But Hold Local

These candidates are useful, but look like variants or duplicates of the same underlying learning and should stay local for now:

- `cand_brightspacequizexporter_codex_report_3642ff0a5fa8`
- `cand_brightspacequizexporter_codex_report_36651f59311f`
- `cand_brightspacequizexporter_codex_report_6a13f70b1122`
- `cand_brightspacequizexporter_codex_report_8b35f4012bd5`
- `cand_brightspacequizexporter_codex_report_c84cbd81aa07`
- `cand_brightspacequizexporter_codex_report_9c1547418c87`

Hold reason:

- They mostly express the same family of QTI visual-proof learnings.
- Promoting all of them would create duplicate durable memory.
- The canonical representatives above already cover the reusable pattern with less noise.

## Do Not Promote

### `cand_brightspacequizexporter_codex_report_f2f3c24f5c9c`

- Reason:
  - This is mainly handoff/session recovery context.
  - Useful trace evidence, but not a durable STAX product learning.

## Approval Note

This shortlist is the recommended human-review set.
It does not itself promote any candidate.
