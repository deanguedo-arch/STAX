# Next Stage Report

## Scope

Implemented the next governance layer without changing STAX fitness behavior, adding UI, embeddings, autonomous shell execution, or new agents.

Follow-up update: added the terminal chat control surface and read-only local evidence collection for Codex Audit and Project Brain state checks.

## Files Created

- Baseline/project governance docs: `docs/BASELINE_V0_1.md`, `docs/PROJECT_STATE.md`, `docs/DECISION_LOG.md`, `docs/KNOWN_FAILURES.md`, `docs/NEXT_ACTIONS.md`, `docs/RISK_REGISTER.md`, `docs/PROVEN_WORKING.md`, `docs/UNPROVEN_CLAIMS.md`, `docs/EVIDENCE_REGISTRY.md`, `docs/CLAIM_LEDGER.md`.
- Mode contracts and registry: `modes/project_brain.mode.md`, `modes/codex_audit.mode.md`, `modes/prompt_factory.mode.md`, `modes/test_gap_audit.mode.md`, `modes/policy_drift.mode.md`, `modes/registry.json`.
- Task prompts: `prompts/tasks/project_brain.md`, `prompts/tasks/codex_audit.md`, `prompts/tasks/prompt_factory.md`, `prompts/tasks/test_gap_audit.md`, `prompts/tasks/policy_drift.md`.
- Schemas/validators: `src/schemas/ProjectBrainOutput.ts`, `src/schemas/CodexAuditOutput.ts`, `src/schemas/PromptFactoryOutput.ts`, `src/schemas/TestGapAuditOutput.ts`, `src/schemas/PolicyDriftOutput.ts`, `src/validators/ProjectBrainValidator.ts`, `src/validators/CodexAuditValidator.ts`, `src/validators/PromptFactoryValidator.ts`, `src/validators/TestGapAuditValidator.ts`, `src/validators/PolicyDriftValidator.ts`, `src/validators/markdownSections.ts`.
- Registry helpers: `src/evidence/EvidenceRegistry.ts`, `src/claims/ClaimLedger.ts`, `src/modes/ModeRegistry.ts`.
- Regression evals/goldens: new Project Brain, Codex Audit, Prompt Factory, Test Gap, and Policy Drift fixtures under `evals/regression/` and `goldens/`.
- Tests: `tests/governanceModes.test.ts`, `tests/evidenceClaimRegistry.test.ts`.
- Chat/local evidence: `src/chat/ChatSession.ts`, `src/evidence/LocalEvidenceCollector.ts`, `tests/chatSession.test.ts`, `tests/localEvidence.test.ts`, `docs/CHAT_CLI.md`.

## Files Modified

- Runtime/mode plumbing: `src/schemas/Config.ts`, `src/schemas/zodSchemas.ts`, `src/classifiers/ModeDetector.ts`, `src/classifiers/DetailLevelController.ts`, `src/agents/AgentRouter.ts`, `src/core/InstructionStack.ts`, `src/policy/PolicySelector.ts`, `src/utils/validators.ts`, `src/evaluators/PropertyEvaluator.ts`.
- Agent behavior: `src/agents/AnalystAgent.ts`, `src/agents/PlannerAgent.ts`.
- Memory/CLI: `src/memory/memoryTypes.ts`, `src/memory/MemoryStore.ts`, `src/cli.ts`.
- Local evidence behavior: `src/agents/AnalystAgent.ts` now uses local evidence blocks in Project Brain and Codex Audit.

## Commands Run

- `npm install`: passed; restored local dev dependencies after initial `tsc: command not found`.
- `npm run typecheck`: passed.
- `npm test`: passed, 31 files and 84 tests.
- `npm run rax -- eval`: passed, 16/16, passRate 1, criticalFailures 0.
- `npm run rax -- eval --redteam`: passed, 9/9, passRate 1, criticalFailures 0.
- `npm run rax -- eval --regression`: passed, 15/15, passRate 1, criticalFailures 0.
- `npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."`: passed, run `run-2026-04-25T02-57-39-833Z-f91nud`.
- `npm run rax -- run --mode project_brain --file docs/PROJECT_STATE.md`: passed, run `run-2026-04-25T02-57-43-114Z-g91ucx`.
- `npm run rax -- run --mode codex_audit "Codex says all tests pass but provides no output."`: passed, run `run-2026-04-25T02-57-48-139Z-b32y5y`.
- `npm run rax -- mode maturity`: passed.
- `npm run rax -- chat --once "what are we doing next?"`: passed, run `run-2026-04-25T03-40-10-003Z-26053x`.
- `printf '/state\n/prompt harden codex audit local evidence\n/runs\n/quit\n' | npm run rax -- chat`: passed, runs `run-2026-04-25T03-40-14-957Z-ni84bh` and `run-2026-04-25T03-40-14-962Z-1jrfk9`.
- `npm run rax -- codex-audit-local --report /tmp/rax-codex-local-report.md`: passed, run `run-2026-04-25T03-40-18-929Z-mezyh1`.

## Project Brain Example

The Project Brain smoke output separates evidence-backed claims from unproven work:

- Proven Working cites `ev_001` and `ev_002`.
- Missing Tests now says Project Brain and Codex Audit have initial regression evals, but still need replay proof and correction-promotion cases before behavior-proven status.
- Codex Prompt remains bounded to a smallest remaining governance-mode gap and requires typecheck, tests, evals, and smoke output.

## Codex Audit Example

For `Codex says all tests pass but provides no output.`, Codex Audit returned:

- Evidence Found: none.
- Missing Evidence: test/typecheck/eval output and modified files.
- Fake-Complete Flags: claimed tests pass without output.
- Approval Recommendation: reject until evidence is supplied.

## Codex Audit Local-Evidence Example

`codex-audit-local` collected:

- `git status --short`
- `git diff --stat`
- `git diff --name-only`
- latest eval result: `evals/eval_results/2026-04-25T03-39-58-433Z.json`
- latest run folder
- mode maturity

The audit output listed changed files, cited local git/eval/run evidence, and kept the recommendation at needs-review rather than auto-approve.

## Chat Smoke Transcript

The chat smoke:

```bash
printf '/state\n/prompt harden codex audit local evidence\n/runs\n/quit\n' | npm run rax -- chat
```

returned Project Brain local state with latest eval/run/mode maturity, then a bounded Prompt Factory task, then the two run IDs.

## Mode Maturity Result

- `stax_fitness`: `behavior_proven`, no proof gaps.
- `project_brain`, `codex_audit`, `prompt_factory`, `test_gap_audit`, `policy_drift`: `usable`, with replay proof and correction path still open.
- `general_chat`: `draft`.

## Remaining Limitations

- Governance modes are usable, not behavior-proven. They still need replay drift proof and correction-promotion cases.
- `EvidenceRegistry` and `ClaimLedger` currently parse markdown registries; they do not yet auto-write approved claims.
- Codex Audit now has read-only local git/eval/run evidence collection, but it still does not run tests itself or inspect full file contents.
- Mode registry maturity rules are deterministic and conservative; they do not inspect every artifact deeply yet.
