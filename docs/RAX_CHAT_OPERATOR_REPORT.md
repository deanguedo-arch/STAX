# RAX Chat Operator Report

Status: implemented.

## Scope

Added STAX Chat Operator v1A: a proof-first natural-language operation router for the first three daily control requests.

The operator handles:

- `audit_workspace`
- `judgment_digest`
- `audit_last_proof`
- `unknown_fallback`

## Files Created

- `src/operator/OperationSchemas.ts`
- `src/operator/ChatIntentClassifier.ts`
- `src/operator/OperationRegistry.ts`
- `src/operator/OperationRiskGate.ts`
- `src/operator/OperationExecutor.ts`
- `src/operator/OperationFormatter.ts`
- `tests/chatOperator.test.ts`
- `docs/STAX_CHAT_OPERATOR.md`
- `docs/RAX_CHAT_OPERATOR_REPORT.md`

## Files Modified

- `src/chat/ChatSession.ts`
- `tests/chatSession.test.ts`

## Behavior

Normal chat can now infer:

```txt
audit canvas-helper -> audit_workspace
audit this repo -> audit_workspace
what needs my judgment? -> judgment_digest
what did the last run prove? -> audit_last_proof
```

Every recognized operator request creates a typed `OperationPlan`.

Broad or high-risk requests are deliberately not guessed from casual text:

```txt
stress test planning -> deferred review-only operator response
approve all memory candidates -> hard-blocked operator response
```

## Safety

- Missing named workspaces do not fall back to another repo.
- Judgment digest reads the current persisted review queue only.
- High-risk natural-language requests hard-block before execution.
- Broad lab/eval/comparison/Codex-prompt requests are deferred to explicit slash or CLI commands.
- No operator path approves or promotes memory, evals, training records, policies, schemas, modes, config, or source patches.

## Validation Results

```bash
npm run typecheck
# passed

npm test
# 43 files / 160 tests passed

npm run rax -- eval
# total 16, passed 16, failed 0, criticalFailures 0

npm run rax -- eval --regression
# total 37, passed 37, failed 0, criticalFailures 0

npm run rax -- eval --redteam
# total 9, passed 9, failed 0, criticalFailures 0
```

## Smoke Results

```bash
npm run rax -- chat --once "audit this repo"
# Operation: audit_workspace
# Actions: OperationRiskGate, current repo root, collectLocalEvidence,
# RepoSummary.summarize, RaxRuntime.run codex_audit
# Created codex_audit run and trace.

npm run rax -- chat --once "what did the last run prove?"
# Operation: audit_last_proof
# Actions: auditLastWithProof, RaxRuntime.run codex_audit
# Checked last chat-linked run, trace.json, linked LearningEvent, and local evidence.

npm run rax -- chat --once "what needs my judgment?"
# Operation: judgment_digest
# Actions: ReviewQueue.list
# Artifacts Created: None
# Read persisted review queue only; no refresh, apply, approve, reject, archive, or promote.

npm run rax -- chat --once "stress test planning"
# Operation: unknown
# ExecutionClass: review_only
# Result: Deferred by Chat Operator v1A. No action was executed.

npm run rax -- chat --once "approve all memory candidates"
# Operation: unknown
# ExecutionClass: hard_block
# Result: Blocked by Chat Operator v1A. No action was executed.
```

## Remaining Limitations

- Chat Operator v1A intentionally supports only the first daily proof operations.
- Lab stress tests, eval/regression runs, model comparison, and Codex handoff generation still require explicit slash or CLI commands.
- The operator can create proof/audit run artifacts for allowed operations, but it cannot approve, promote, merge, train, or mutate source/external repos.
