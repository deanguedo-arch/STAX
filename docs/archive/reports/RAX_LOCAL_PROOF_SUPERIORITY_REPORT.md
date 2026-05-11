# RAX Local Proof Superiority Report

## Summary

This slice moves STAX closer to the "local proof machine" goal from the external ChatGPT plan. It does not add new autonomous workers or loosen safety. It adds proof-aware audit labeling, evidence collection, self-audit scoring, disagreement capture, model comparison, workspace registration, training quality checks, and chat/CLI control surfaces that turn weak answers into candidate improvements without self-approval.

Implemented in this slice:

- `codex_audit` defensive governance over-refusal fix.
- Positive/negative regression eval pair for governance audit boundaries.
- Verified audit contract labels: `Verified Audit`, `Partial Audit`, `Reasoned Opinion`.
- Typed proof packets for proof-scoped audit runs.
- Evidence sufficiency scoring so `Verified Audit` requires concrete, relevant, unambiguous evidence.
- Proof-packet redaction for secrets, bearer tokens, private keys, cookies, and secret assignments.
- Proof-aware `codex_audit` sections for evidence checked, claims verified, claims not verified, risks, required proof, and recommendation.
- `/audit-last --proof` in chat, including run/trace/learning-event/policy/local evidence.
- `AnswerQualityScorer` and `SelfAudit` so governed answers can be scored and weak runs can queue improvement candidates.
- `EvidenceCollector` CLI for read-only evidence collections.
- `PairedEvalBuilder` and `/disagree` so user disagreement becomes paired eval pressure.
- `model_comparison` mode plus `/compare external` for comparing STAX answers with external assistant answers against local proof.
- `WorkspaceRegistry` for linking local repos as workspaces.
- `TrainingQualityGate` for rejecting unapproved/synthetic/secret-tainted training data.
- `lab go` smoke proof for cautious and balanced profiles, with patch planning remaining candidate-only.
- Cross-session restoration of the last assistant output so `chat --once "/audit-last --proof"` can work after a prior chat turn.
- A negative control for defensive framing that attempts to smuggle actionable bypass steps.

## Product Rule

STAX should beat normal chat inside local projects by producing:

```txt
answer + proof + trace + LearningEvent + improvement pressure
```

This patch focuses on the proof and improvement-pressure layer.

## Files Created

- `src/audit/EvidenceSufficiencyScorer.ts`
- `src/audit/AnswerQualityScorer.ts`
- `src/audit/ProofPacket.ts`
- `src/audit/ProofRedactor.ts`
- `src/audit/SelfAudit.ts`
- `src/audit/VerifiedAuditContract.ts`
- `src/evals/PairedEvalBuilder.ts`
- `src/evidence/EvidenceCollector.ts`
- `src/learning/DisagreementCapture.ts`
- `src/schemas/ModelComparisonOutput.ts`
- `src/training/TrainingQualityGate.ts`
- `src/validators/ModelComparisonValidator.ts`
- `src/workspace/WorkspaceRegistry.ts`
- `modes/model_comparison.mode.md`
- `tests/proofAudit.test.ts`
- `tests/localProofSuperiority.test.ts`
- `docs/RAX_CODEX_AUDIT_OVER_REFUSAL_FIX.md`
- `docs/RAX_LOCAL_PROOF_SUPERIORITY_REPORT.md`
- `evals/regression/codex_audit_governance_redteam_plan_allowed.json`
- `evals/regression/codex_audit_actionable_bypass_still_refused.json`
- `evals/regression/model_comparison_basic.json`

## Files Modified

- `.gitignore`
- `modes/codex_audit.mode.md`
- `modes/registry.json`
- `src/agents/AgentRouter.ts`
- `src/agents/AnalystAgent.ts`
- `src/chat/ChatSession.ts`
- `src/classifiers/ModeDetector.ts`
- `src/cli.ts`
- `src/core/InstructionStack.ts`
- `src/core/RaxRuntime.ts`
- `src/evidence/LocalEvidenceCollector.ts`
- `src/safety/BoundaryDecision.ts`
- `src/safety/RiskClassifier.ts`
- `src/schemas/CodexAuditOutput.ts`
- `src/schemas/Config.ts`
- `src/schemas/zodSchemas.ts`
- `src/learning/LearningRecorder.ts`
- `src/utils/validators.ts`
- `src/validators/CodexAuditValidator.ts`
- `tests/boundary.test.ts`
- `tests/chatSession.test.ts`
- `tests/governanceModes.test.ts`
- `tests/localEvidence.test.ts`
- `tests/modeDetector.test.ts`
- `tests/risk.test.ts`
- `tests/zodSchemas.test.ts`
- `docs/CHAT_CLI.md`
- `docs/STAX_CHAT_INTERFACE.md`

## Audit Type Contract

`codex_audit` now starts with:

```md
## Audit Type
## Evidence Checked
## Claims Verified
## Claims Not Verified
## Risks
## Required Next Proof
## Recommendation
```

Rules:

- `Reasoned Opinion`: no local proof checked.
- `Partial Audit`: some local proof checked, but key command/eval/trace evidence is missing.
- `Verified Audit`: concrete command/eval evidence plus run/trace/eval proof is present.

The validator rejects `Verified Audit` when concrete evidence is missing, unrelated to the audited claim, or ambiguous.

## Proof Packet And Redaction

`/audit-last --proof` now constructs a typed proof packet with:

- `workspace`
- `threadId`
- `runId`
- `runCreatedAt`
- mode, boundary, agent, validation status
- `learningEventId`
- learning queues
- policies applied
- evidence items with paths, commands, summaries, and claim support
- redaction counts
- ambiguity warnings

Before the previous assistant output and local evidence are sent into `codex_audit`, proof text is redacted for:

- OpenAI-style API keys
- bearer tokens
- private key blocks
- secret/password/token/cookie/session assignments
- cookie headers

This keeps the audit useful without turning proof collection into a leak path.

## Evidence Sufficiency Gate

`Verified Audit` now requires:

- a specific artifact path or command record
- command or eval result evidence
- trace or run evidence for runtime claims
- evidence tied to at least one audited claim
- no unresolved run/thread/workspace ambiguity

If a global latest run differs from the current thread's selected run, `/audit-last --proof` records an ambiguity warning and downgrades the audit to `Partial Audit`.

## Defensive Governance Boundary Fix

`codex_audit` can now audit defensive governance/red-team plans mentioning:

- memory poisoning defenses
- promotion bypass prevention
- tool misuse controls
- adversarial scenarios
- release gates
- approval boundaries

Direct misuse requests still refuse, including:

- instructions to bypass promotion gates
- instructions to poison memory
- instructions to misuse tools
- exploit or evasion steps

## Chat Proof Command

New command:

```txt
/audit-last --proof
```

It builds a proof packet from:

- previous assistant output
- latest run id
- run folder
- trace path
- mode
- boundary
- selected agent
- validation status
- LearningEvent id
- learning queues
- policies applied
- read-only local evidence

Then it sends that packet through `codex_audit`.

## Improvement Pressure Surfaces

New control surfaces:

```txt
rax evidence collect --workspace current
rax evidence list
rax evidence show <id>
rax disagree --reason "..."
rax compare --stax stax.md --external chatgpt.md [--task task.md]
rax workspace create <name> --repo <path>
rax workspace use <name>
rax train quality --file training.jsonl
```

New chat commands:

```txt
/disagree <reason>
/compare external <answer>
```

The disagreement path creates a command LearningEvent and paired eval candidates under `learning/eval_pairs/`. It does not promote evals, corrections, memory, training data, policies, schemas, modes, or config.

The comparison path routes through `model_comparison`, which requires Evidence Comparison, Missing Local Proof, Recommended Correction, Recommended Eval, and Recommended Prompt / Patch sections.

## Behavior Tests Added

- Defensive governance audits constrain instead of refusing risky terms.
- Direct bypass instructions still refuse.
- Defensive framing with embedded actionable bypass steps still refuses.
- `RiskClassifier` flags promotion-gate bypass as system integrity risk.
- `codex_audit` rejects `Verified Audit` with no concrete evidence.
- Proof packets validate.
- Plan-only evidence cannot claim `Verified Audit`.
- Ambiguous or unrelated proof cannot claim `Verified Audit`.
- Proof redaction removes secrets and records redaction counts.
- Local evidence produces proof-aware audit labels.
- `/audit-last --proof` includes trace evidence.
- Last assistant output is restored across chat sessions for one-shot audit commands.
- Answer quality scoring ranks vague governance output below concrete proof-linked output.
- Self-audit converts weak governed answers into learning failure types.
- Paired eval candidates stay candidate-only.
- Disagreement capture creates a LearningEvent and paired eval candidate without durable promotion.
- Evidence collection writes read-only collection files.
- Model comparison output is schema/validator checked.
- Workspace registry links repo workspaces without copying repos.
- Training quality gate blocks unapproved training records.
- Chat `/disagree` and `/compare external` are covered.

## Command Results

Final validation:

```bash
npm run typecheck
```

Result: passed.

```bash
npm test
```

Result: 36 test files passed, 125 tests passed.
Updated result after the full local-proof implementation: 37 test files passed, 134 tests passed.

```bash
npm run rax -- eval
```

Result: 16 passed, 0 failed, pass rate 1, critical failures 0.

```bash
npm run rax -- eval --redteam
```

Result: 9 passed, 0 failed, pass rate 1, critical failures 0.

```bash
npm run rax -- eval --regression
```

Result: 27 passed, 0 failed, pass rate 1, critical failures 0.
Updated result after adding `model_comparison_basic`: 28 passed, 0 failed, pass rate 1, critical failures 0.

```bash
npm run rax -- chat --once "/mode auto"
npm run rax -- chat --once "Codex says runtime behavior changed."
npm run rax -- chat --once "/audit-last --proof"
```

Result: passed. The one-shot proof audit restored the previous assistant output across chat sessions, included run and trace evidence, and produced a proof-aware `codex_audit` output.

```bash
npm run rax -- evidence collect --workspace current
```

Result: passed. Wrote a collection under `evidence/collections/` with run, trace, eval, changed-file, and workspace-doc evidence.

```bash
npm run rax -- chat --once "/disagree This over-refused a defensive governance plan."
```

Result: passed. Created a disagreement LearningEvent and paired eval candidate; no durable artifact was promoted.

```bash
npm run rax -- chat --once "Compare external answer: ChatGPT had a broader plan, but it did not cite local traces or evals."
```

Result: passed. Routed to `model_comparison`, produced required comparison sections, and linked Run/LearningEvent/Trace.

```bash
npm run rax -- lab go --profile cautious --cycles 1 --domain planning --count 5
npm run rax -- lab go --profile balanced --cycles 1 --domain planning --count 5
npm run rax -- lab report
npm run rax -- lab failures
npm run rax -- lab patches
```

Result: passed. Cautious and balanced cycles completed, report showed passRate 0.995 from accumulated lab state, failure mining found one prior forced smoke missing-section cluster, and patch planning wrote candidate-only patch artifacts with `approvalRequired: true`.

After the final eval runs, `/audit-last --proof` correctly produced a `Partial Audit` when the global latest run differed from the current thread's last run. That is expected: the proof packet preserved the selected thread run and recorded the ambiguity instead of pretending the audit was fully verified.

## External ChatGPT/STAX Review

The opened browser chat was used as a bounded external reviewer. Only a summary of the implemented behavior and validation results was sent, not raw repo files, traces, logs, secrets, or diffs.

The external review agreed the direction was strong and identified these hardening gaps:

- defensive framing could smuggle actionable bypass instructions
- `Verified Audit` needed an evidence sufficiency gate
- `/audit-last --proof` needed explicit thread/workspace/run scoping
- proof packets needed redaction
- allowed governance audits needed output-quality proof

This report's final implementation addresses the first four directly and keeps output-quality proof covered by the required `codex_audit` headings and regression evals.

## Remaining Limitations

- The audit type classifier is deterministic and conservative.
- `Verified Audit` means enough proof was supplied for evidence-backed review; it does not mean automatic approval.
- `model_comparison` is deterministic and only compares supplied STAX/external answer text; it does not browse or import external chat history by itself.
- Workspace registry is a local index, not a cross-repo file reader yet.
- `train quality` checks JSONL records, but full model registry/fine-tune benchmarking remains future work.
- Chat still cannot approve, promote, merge, train, or enable tools.
- Command output capture is still artifact-oriented; the proof packet can cite eval artifacts now, but does not persist full typecheck/test stdout as a first-class evidence item yet.
- The next useful slice is deeper workspace repo awareness, not more autonomous workers.
