# RAX Workspace Repo Operator Report

Status: implemented and validated.

## Scope

Added a read-only Workspace Repo Operator so STAX chat can answer plain repo questions with evidence:

```txt
what tests exist in this repo?
what is risky in this repo?
fix this repo
what tests exist in canvas-helper?
```

The operator uses existing governed chat infrastructure:

```txt
ChatIntentClassifier
-> OperationPlan
-> OperationRiskGate
-> WorkspaceContext
-> RepoEvidencePack
-> RaxRuntime codex_audit
```

## Files Created

- `src/workspace/RepoEvidenceSchemas.ts`
- `src/workspace/RepoPathGuards.ts`
- `src/workspace/RepoSafeFileReader.ts`
- `src/workspace/RepoEvidencePack.ts`
- `tests/workspaceRepoOperator.test.ts`
- `evals/regression/workspace_repo_operator_readonly_evidence_pack.json`
- `evals/regression/workspace_repo_operator_secret_and_mutation_block.json`
- `docs/STAX_WORKSPACE_REPO_OPERATOR.md`
- `docs/RAX_WORKSPACE_REPO_OPERATOR_REPORT.md`

## Files Modified

- `src/chat/ChatSession.ts`
- `src/agents/AnalystAgent.ts`
- `src/operator/ChatIntentClassifier.ts`
- `src/operator/OperationExecutor.ts`
- `src/operator/OperationRegistry.ts`
- `src/operator/OperationSchemas.ts`
- `tests/chatOperator.test.ts`
- `tests/workspaceRuntime.test.ts`
- `docs/STAX_CHAT_OPERATOR.md`

## Behavior

- `audit canvas-helper` still requires the named workspace to exist.
- `audit this repo` respects the active linked workspace when present.
- `what tests exist in this repo?` builds a repo evidence pack, finds scripts/test files, and states tests were not run.
- `what is risky in this repo?` uses the same evidence pack to surface missing files, skipped unsafe paths, redactions, and missing test signals.
- `fix this repo` becomes an audit/planning request and does not mutate the linked repo.

## Safety

The repo reader skips ignored and unsafe paths:

- `node_modules`
- `.git`
- `dist`
- `build`
- `coverage`
- `.env` and `.env.*`
- secret-like paths
- `*.pem` and `*.key`
- symlinks
- large files
- binary files

It redacts secret-like values in otherwise safe text files.

## Validation Results

Focused validation already run:

```bash
npm run typecheck
# passed

npm test -- tests/workspaceRepoOperator.test.ts tests/chatOperator.test.ts tests/workspaceRuntime.test.ts
# 3 files / 18 tests passed
```

Full validation:

```bash
npm run typecheck
# passed

npm test
# 44 files / 169 tests passed

npm run rax -- eval
# total 16, passed 16, failed 0, criticalFailures 0

npm run rax -- eval --regression
# total 39, passed 39, failed 0, criticalFailures 0

npm run rax -- eval --redteam
# total 9, passed 9, failed 0, criticalFailures 0

npm run rax -- chat --once "what tests exist in this repo?"
# Operation: workspace_repo_audit
# RepoEvidencePack.build
# Scripts / Test Commands Found
# Tests were not run in the linked repo.

npm run rax -- chat --once "what is risky in this repo?"
# Operation: workspace_repo_audit
# RepoEvidencePack.build
# Risks section emitted from read-only evidence.

npm run rax -- chat --once "fix this repo"
# Operation: workspace_repo_audit
# Objective: Audit and plan next allowed actions for the target repo without mutating it.
# No source files were modified.
```

## Smoke Commands

```bash
npm test
npm run rax -- eval
npm run rax -- eval --regression
npm run rax -- eval --redteam
npm run rax -- chat --once "what tests exist in this repo?"
npm run rax -- chat --once "what is risky in this repo?"
npm run rax -- chat --once "fix this repo"
```

## Remaining Limitations

- Linked repo tests are detected but not executed.
- Linked repo files are never patched by this operator.
- External repo mutation, shell expansion, promotions, and Codex handoffs remain outside this slice.
