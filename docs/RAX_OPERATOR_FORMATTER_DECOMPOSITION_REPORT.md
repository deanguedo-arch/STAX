# RAX Operator Formatter Decomposition Report

Date: 2026-04-28

## Purpose

The gate-wiring work made `OperationFormatter` a live control hub for evidence,
visual proof, judgment packets, runtime proof, dependency blockers, sync
boundaries, and problem movement. This refactor keeps the same behavior while
reducing the chance that the formatter becomes a conditional maze.

## Review Packet

### Red Team

- Risk: moving proof logic can accidentally hide first-pass failure or weaken
  `ProblemMovementGate`.
- Risk: adapters can become a second execution lane if they start running
  commands, writing files, or mutating linked repos.
- Negative control: behavior must stay covered by existing operator,
  problem-movement, benchmark, and redteam tests.

### Blue Team

- Smallest safe patch: extract conditional formatting helpers from
  `OperationFormatter` into focused builders/adapters without changing schemas,
  CLI commands, gate thresholds, or execution permissions.
- Keep `OperationFormatter` responsible only for receipt construction,
  validation, outcome rendering, `ProblemMovementGate`, and markdown validation.
- Reuse the existing test surface instead of adding a new snapshot layer for a
  pure decomposition.

### Green Team

- The change helps Dean because future operator wiring can land in named
  components instead of a single growing conditional hub.
- Reports stay decision-useful: the output behavior is unchanged, and the
  maintainability win is explicitly separated from any superiority or execution
  claim.

### Consensus

- Decision: keep.
- Proof impact: maintainability only; this does not advance broad superiority
  proof or autonomous execution maturity.
- Do-not-build list: no execution lane activation, no linked repo mutation, no
  approvals, no promotions, no shell/file-write enablement.

## New Structure

`OperationFormatter` is now a thin orchestrator:

- build the operation receipt;
- validate the receipt;
- build the outcome header;
- run `ProblemMovementGate`;
- render receipt/output;
- validate markdown.

Focused components now own the conditional behavior:

| File | Responsibility |
|---|---|
| `src/operator/OutcomeHeaderBuilder.ts` | Builds and renders direct answer, next step, why, and proof status. |
| `src/operator/DirectAnswerBuilder.ts` | Builds the direct answer from operator evidence and intent. |
| `src/operator/NextStepBuilder.ts` | Builds one next step and why-this-step text. |
| `src/operator/OperatorEvidenceAdapters.ts` | Shared command, repo, dependency, sync, and missing-evidence helpers. |
| `src/operator/OperatorVisualAdapter.ts` | Visual proof protocol adapter for rendered-preview claims. |
| `src/operator/OperatorJudgmentAdapter.ts` | Judgment packet adapter for operator review decisions. |

## Guardrails Preserved

- No linked repo mutation.
- No shell/file-write enablement.
- No auto-promotion.
- No new durable agents.
- No execution lane activation.
- `ProblemMovementGate` still validates the final user-facing outcome.

## Validation

The extraction is behavior-preserving and covered by existing operator,
problem-movement, review, benchmark, and evidence-decision tests.

Commands used for this refactor:

```bash
npm run typecheck
npm test -- --run tests/chatOperatorReceipt.test.ts tests/problemMovementGate.test.ts tests/evidenceDecisionGate.test.ts tests/reviewRouter.test.ts tests/localProblemBenchmark.test.ts
npm test
npm run rax -- eval
npm run rax -- eval --regression
npm run rax -- eval --redteam
npm run rax -- compare benchmark --file fixtures/problem_benchmark/fresh_holdout_25_tasks.json
npm run rax -- compare adversary --file fixtures/problem_benchmark/fresh_holdout_25_tasks.json
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
```
