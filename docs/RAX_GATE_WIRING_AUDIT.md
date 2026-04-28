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
| `ProofBoundaryClassifier` | yes | yes | via `codex-audit-local` / model comparison output | yes, through `EvidenceDecisionGate` in `AnalystAgent` | regression eval only | yes, for audit scope and next proof | yes | Strong for audit/model-comparison answers; now also hands visual proof families to `VisualEvidenceProtocol`. |
| `RuntimeEvidenceGate` | yes | yes | via `codex-audit-local` / model comparison output | yes, through `EvidenceDecisionGate` and `EvidenceRequestBuilder` fallback requests | no direct benchmark gate | yes, blocks failed runtime claims in audits and shapes missing-evidence requests | yes | Live in audit answers and low-evidence request construction; still not a benchmark scoring primitive. |
| `HoldoutFreshnessGate` | yes | yes | via `compare benchmark` for required fresh holdouts | no | yes for `fresh_holdout_25_tasks` and opted-in collections | yes, failed freshness contributes summary gaps | yes | Stronger. The fresh holdout fixture now opts in, and scoring reports freshness gaps instead of silently treating recycled cases as fresh. |
| `ExternalBaselineImport` | yes | yes | yes: `compare import-baseline --file` | no | partial metadata logic exists separately in benchmark | yes in import CLI | yes | Partial. The import validator is live CLI, but benchmark scoring does not consume an imported baseline artifact yet. |
| `BaselineDateGate` | yes | yes | via `superiority status/score/campaign` | no | yes, through `GeneralSuperiorityGate` | yes | yes | Strong for superiority. It contributes date status and blocks broad claims. |
| `ExternalSourceDiversityGate` | yes | yes | via `superiority status/score/campaign` | no | yes, through `GeneralSuperiorityGate` | yes | yes | Strong for superiority. It canonicalizes source identity for broad-campaign status. |
| `BenchmarkAdversary` | yes | yes | yes: `compare adversary --file` | no | partial, via scorer anti-gaming penalties | yes, CLI fails when mutations beat clean answers | yes | Live CLI control. The scorer still carries penalties, and adversary reporting is now visible instead of unit-test-only. |
| `VisualEvidenceProtocol` | yes | yes | via `codex-audit-local` / model comparison output | yes, through `OperationFormatter` and `EvidenceDecisionGate` | no | yes, visual claims remain missing/partial and force screenshot/finding next step | yes | Live for operator and audit visual proof gaps. |
| `EvidenceRequestBuilder` | yes | yes | via `compare benchmark` result output for `no_local_basis` | yes, through `OperationFormatter` missing-evidence fallback | yes, for no-local-basis result reports | yes, low-evidence operator and benchmark answers now ask for a typed minimal evidence packet | yes | Live for operator fallback requests and benchmark no-local-basis reporting. |
| `JudgmentPacketBuilder` | yes | yes | via `review inbox/digest/staged/blocked/all` formatting | yes, through `OperationFormatter` `judgment_digest` output | no | yes, judgment output names human approval and a recommendation without acting | yes | Live for operator digest and review inbox-style subcommands. |
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
   `EvidenceRequestBuilder` now also uses them for operator missing-evidence
   requests.

3. Some former utility-only gates now control operator, audit, or benchmark output.
   `VisualEvidenceProtocol`, `EvidenceRequestBuilder`, and
   `JudgmentPacketBuilder` are called from `OperationFormatter`,
   `EvidenceDecisionGate`, `LocalProblemBenchmark`, or `ReviewQueue`. Their
   failures do not mutate state; they change the direct answer, report rows, or
   required next proof.

4. Several modules are intentionally not live controllers yet.
   `StrategyMode`, `ExecutionMaturity`, and `ExecutionLane` remain tested,
   documented control surfaces. They are not finished as broad user-facing
   behavior until a CLI/chat/operator path calls them.

5. Execution remains restrained.
   `ExecutionLane` and `ExecutionMaturity` do not create sandboxes, run
   commands, patch files, mutate linked repos, commit, push, or promote durable
   state. That is the correct status for this slice.

## Highest-Value Wiring Gaps

1. Add direct CLI smoke coverage for no-local-basis evidence requests.
   Expected behavior: a low-evidence fixture prints the typed request in
   `compare benchmark` output.

2. Expand visual evidence parsing beyond missing-artifact detection.
   Expected behavior: screenshot plus route/viewport/checklist can become
   partial or verified for listed visual checks only.

3. Expand judgment packets from compact inbox lines to full packet views when
   requested.
   Expected behavior: sync, promote, risky command, deploy, and sandbox/apply
   questions produce decision-ready packets, not implied actions.

4. Keep `ExecutionLane` unwired to execution until a separate approval protocol
   is designed and reviewed.
   Expected behavior: STAX can report maturity/readiness, but still cannot
   mutate linked repos or apply patches without a future explicit governance
   slice.

## Bottom Line

The 4-15 gates now exist, many are tested, and the first wiring closure pass
connected the highest-risk utility-only surfaces to live operator or benchmark
paths. This still does not make execution autonomous or prove global
superiority; it makes the next GPT audit harder to dismiss as "files exist, but
nothing controls behavior."
