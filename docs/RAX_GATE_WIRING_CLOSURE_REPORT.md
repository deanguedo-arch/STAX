# RAX Gate Wiring Closure Report

Date: 2026-04-28

## Purpose

This pass closes the gap between "gate exists" and "gate controls a live path"
for the highest-risk proof surfaces from the 4-15 plan.

Acceptance for this pass:

- the gate is called by a CLI, benchmark, or operator path;
- a failed or missing gate changes output, status, or required next proof;
- negative tests cover the failure mode;
- no linked repo mutation, auto-promotion, or execution power is introduced.

## Closed Wiring

| Gate | Live path | Behavior when proof is missing or adversarial | Test coverage |
|---|---|---|---|
| `VisualEvidenceProtocol` | `OperationFormatter` rendered-preview branch | Source files/scripts now produce `VisualEvidenceProtocol: missing` and force screenshot/manual visual finding as the next proof. | `chatOperatorReceipt.test.ts` rendered-preview test |
| `EvidenceRequestBuilder` | `OperationFormatter` missing-evidence fallback | Low-evidence operator output asks for a typed minimum evidence packet instead of a generic refusal. | Existing builder tests plus formatter validation |
| `JudgmentPacketBuilder` | `OperationFormatter` `judgment_digest` branch | Review/judgment output now emits a packet recommendation and `requiresHumanApproval=true`; it still does not act. | `chatOperatorReceipt.test.ts` judgment packet test |
| `BenchmarkAdversary` | `rax compare adversary --file fixture.json` | Garbage, command-stuffed, fake-evidence, and slogan-stuffed answers are scored against clean answers and can fail the CLI gate. | `benchmarkAdversary.test.ts`; CLI smoke command |
| `HoldoutFreshnessGate` | `fresh_holdout_25_tasks.json` via `compare benchmark --file` | Fresh holdout scoring now requires local freshness checks and reports freshness gaps if a case repeats repo/family/boundary. | `localProblemBenchmark.test.ts` fresh holdout + duplicate negative |

The first adversary smoke run found a real scoring gap: fake local evidence could
raise a few fixture scores by one point. The scorer now applies an explicit
penalty for fake local evidence, unsupported deployment verification, and
"screenshot looks perfect" claims.

## Intentional Non-Closures

`StrategyMode`, `ExecutionMaturity`, and `ExecutionLane` remain utility/control
surfaces in this pass. They are not wired into live execution. That is
intentional: STAX should not gain sandbox, patch, linked-repo apply, commit,
push, release, or promotion power from this wiring closure.

## Proof Impact

This advances slice proof for benchmark integrity and operator evidence truth.

It does not advance broad superiority proof by itself. `GeneralSuperiorityGate`
must still clear blind-comparison, date-diversity, source-diversity,
first-pass-integrity, and non-winning-case requirements before any broader
claim can be made.

## Acceptance Result

Status: `modify_keep`

Keep the 4-15 gates. Modify claims about completion:

- Achieved: high-risk gates now affect at least one live path.
- Not achieved: every gate controlling every possible answer path.
- Still blocked: autonomous execution, linked-repo mutation, auto-promotion,
  and broad superiority claims.
