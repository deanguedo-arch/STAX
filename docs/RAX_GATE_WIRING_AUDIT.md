# RAX Gate Wiring Audit

Date: 2026-04-28

## Purpose

This audit checks whether each gate is only present and tested, or whether it
actually controls a live STAX path.

The honest distinction:

- `Exists` means the implementation file is present.
- `Tested` means unit or integration tests cover it.
- `CLI wired` means a user can invoke it directly or through a CLI report.
- `Chat wired` means normal chat/operator/audit output can be changed by it.
- `Benchmark wired` means benchmark or superiority scoring can be blocked or
  changed by it.
- `Blocks bad output` means a failed gate changes status, winner, proof level,
  or required next proof.
- `Reported` means a docs/report surface explains the gate.

## Wiring Table

| Gate | Exists | Tested | CLI wired | Chat wired | Benchmark wired | Blocks bad output | Reported | Current wiring status |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `FirstPassIntegrityGate` | yes | yes | via benchmark/superiority | no direct chat path | yes | yes | yes | Strong. Used by `LocalProblemBenchmark` and `GeneralSuperiorityGate`; can keep post-correction or unlocked blind evidence out of superiority. |
| `ProofBoundaryClassifier` | yes | yes | via `codex-audit-local` / model comparison output | yes, through `EvidenceDecisionGate` in `AnalystAgent` | regression eval only | yes, for audit scope and next proof | yes | Strong for audit/model-comparison answers; not yet a benchmark scoring primitive. |
| `RuntimeEvidenceGate` | yes | yes | via `codex-audit-local` / model comparison output | yes, through `EvidenceDecisionGate` in `AnalystAgent` | no direct benchmark gate | yes, blocks failed runtime claims in audits | yes | Useful and live in audit answers; still not deeply wired into `OperationFormatter` or benchmark scoring. |
| `HoldoutFreshnessGate` | yes | yes | via `compare benchmark` when fixture opts in | no | optional | yes, if `requireHoldoutFreshness` is set | yes | Partial. It can block opted-in benchmark fixtures, but current default fixture scoring does not require it. |
| `ExternalBaselineImport` | yes | yes | yes: `compare import-baseline --file` | no | partial metadata logic exists separately in benchmark | yes in import CLI | yes | Partial. The import validator is live CLI, but benchmark scoring does not consume an imported baseline artifact yet. |
| `BaselineDateGate` | yes | yes | via `superiority status/score/campaign` | no | yes, through `GeneralSuperiorityGate` | yes | yes | Strong for superiority. It contributes date status and blocks broad claims. |
| `ExternalSourceDiversityGate` | yes | yes | via `superiority status/score/campaign` | no | yes, through `GeneralSuperiorityGate` | yes | yes | Strong for superiority. It canonicalizes source identity for broad-campaign status. |
| `BenchmarkAdversary` | yes | yes | no | no | partial, via scorer anti-gaming penalties | yes, indirectly through lower scores | yes | Partial. The adversary class is test-only; the scorer has anti-gaming penalties, but there is no CLI adversary report yet. |
| `VisualEvidenceProtocol` | yes | yes | no | no | no | no live answer path yet | yes | Utility-only. It defines the right visual proof contract but is not yet called by chat, audit, benchmark, or operator output. |
| `EvidenceRequestBuilder` | yes | yes | no | no | no | no live answer path yet | yes | Utility-only. It composes runtime/proof-boundary requests, but `no_local_basis` and operator next steps do not call it yet. |
| `JudgmentPacketBuilder` | yes | yes | no | no | no | no live approval path yet | yes | Utility-only. Review routing exists elsewhere, but decision packets are not yet emitted by `review`, chat, or operator commands. |
| `StrategyMode` | yes | yes | no; existing `strategy` CLI uses older strategy system | no | no | no live answer path yet | yes | Utility-only. Safe wrapper exists, but live strategy behavior still comes from `StrategicDeliberation` / `StrategicBenchmark`. |
| `ExecutionMaturity` | yes | yes | no | no | no | no live answer path yet | yes | Utility-only by design. It is a read-only maturity calculator and does not unlock execution. |
| `ExecutionLane` / `ExecutionRiskGate` | yes | yes | no | no | no | yes only when called directly | yes | Utility-only by design. It is a pure risk gate and does not execute, patch, sandbox, commit, push, or mutate linked repos. |
| `GeneralSuperiorityGate` | yes | yes | yes: `superiority status/score/campaign` | no | yes | yes | yes | Strong. It still reports `campaign_slice` when blind count/date diversity gaps remain. |

## Findings

1. The benchmark/superiority nervous system is real.
   `FirstPassIntegrityGate`, `BaselineDateGate`, `ExternalSourceDiversityGate`,
   `GeneralSuperiorityGate`, and parts of `HoldoutFreshnessGate` can affect
   benchmark or superiority status.

2. The audit/model-comparison nervous system is real but narrower.
   `RuntimeEvidenceGate` and `ProofBoundaryClassifier` shape `codex_audit` and
   `model_comparison` output through `EvidenceDecisionGate` and `AnalystAgent`.
   They are not yet central to `OperationFormatter`.

3. Several new modules are intentionally not live controllers yet.
   `VisualEvidenceProtocol`, `EvidenceRequestBuilder`, `JudgmentPacketBuilder`,
   `StrategyMode`, `ExecutionMaturity`, and `ExecutionLane` are tested,
   documented control surfaces. They are not finished as user-facing behavior
   until a CLI/chat/operator path calls them.

4. Execution remains restrained.
   `ExecutionLane` and `ExecutionMaturity` do not create sandboxes, run
   commands, patch files, mutate linked repos, commit, push, or promote durable
   state. That is the correct status for this slice.

## Highest-Value Wiring Gaps

1. Wire `EvidenceRequestBuilder` into `LocalProblemBenchmark` and
   `OperationFormatter` for `no_local_basis`, visual, deploy, and runtime gaps.
   Expected behavior: low-evidence outputs name the smallest evidence packet
   instead of relying on scattered handcrafted next-step text.

2. Wire `VisualEvidenceProtocol` into `ProofBoundaryClassifier` or
   `EvidenceDecisionGate` for rendered/UI claims.
   Expected behavior: visual claims without artifact plus checklist remain
   explicitly unverified in audit/operator answers.

3. Wire `JudgmentPacketBuilder` into review and operator decision surfaces.
   Expected behavior: sync, promote, risky command, deploy, and sandbox/apply
   questions produce a decision packet, not an implied action.

4. Add a `compare adversary` CLI or benchmark report section for
   `BenchmarkAdversary`.
   Expected behavior: benchmark-gaming checks become visible proof, not only
   unit-test coverage.

5. Decide whether `HoldoutFreshnessGate` should become required for fresh
   holdout fixture files.
   Expected behavior: new holdout collections cannot silently score as fresh
   without freshness metadata and local evidence.

6. Keep `ExecutionLane` unwired to execution until a separate approval protocol
   is designed and reviewed.
   Expected behavior: STAX can report maturity/readiness, but still cannot
   mutate linked repos or apply patches without a future explicit governance
   slice.

## Bottom Line

The 4-15 gates now exist and many are tested. The strongest live wiring is in
benchmark/superiority and codex-audit/model-comparison proof discipline.

The next honest line is not more gates. It is connecting the utility-only gates
to one user-facing path at a time, with negative tests proving each failed gate
changes the answer or blocks the claim.
