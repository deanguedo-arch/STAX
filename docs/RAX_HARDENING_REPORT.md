# RAX Hardening Report

## Current Implementation Audit

### 1. Provider role separation
- status: weak
- evidence: `src/providers/ModelProvider.ts`, `src/providers/ProviderFactory.ts`, `src/routing/ProviderRouter.ts`, `src/core/RaxRuntime.ts`, `src/schemas/Config.ts`
- risk: runtime records model calls but does not yet prove role-specific routing for generator, critic, evaluator, and classifier in every call.
- required fix: add provider role types/config, route provider calls by role, and log role/provider/model per model call.

### 2. Critic gate enforcement
- status: fake-complete
- evidence: `src/agents/CriticAgent.ts`, `src/validators/CriticGate.ts`, `src/core/RaxRuntime.ts`
- risk: critic output can be generated without blocking invalid, unsafe, or unsupported primary output.
- required fix: make critic review structured, validated, severity-aware, and blocking.

### 3. Repair controller
- status: weak
- evidence: `src/validators/RepairController.ts`, `src/core/RaxRuntime.ts`, `src/core/RunLogger.ts`
- risk: schema retry exists through formatter, but repair is not a first-class one-pass controller with trace/log proof.
- required fix: implement one repair attempt, log repair result, and fail explicitly if repair cannot satisfy critic/schema.

### 4. STAX atomic signal extraction
- status: weak
- evidence: `src/agents/IntakeAgent.ts`, `src/utils/validators.ts`, `tests/staxFitnessMode.test.ts`
- risk: multiple observations can collapse into one Signal Unit, losing useful evidence granularity.
- required fix: add atomic observation splitting, signal typing, timestamp extraction, and multi-SU rendering.

### 5. Eval strictness
- status: weak
- evidence: `src/core/EvalRunner.ts`, `src/evaluators/PropertyEvaluator.ts`, `evals/cases/`, `evals/redteam/`
- risk: evals can pass based on headings and simple string checks without enforcing signal counts, critical failure rules, or boundary expectations.
- required fix: add min signal units, critical enforcement, pass-rate threshold, expected boundary mode, and stricter STAX properties.

### 6. Replay determinism
- status: real
- evidence: `src/core/Replay.ts`, `src/providers/MockProvider.ts`, `tests/replay.test.ts`
- risk: replay compares final output, but trace comparison is still minimal.
- required fix: expand replay report to include replay run id and trace diff summary.

### 7. Correction promotion
- status: real
- evidence: `src/core/Corrections.ts`, `tests/correctionPromotion.test.ts`, `corrections/`, `training/`, `goldens/`
- risk: artifacts exist, but promoted training format can be made stricter.
- required fix: validate correction artifacts and training export JSONL line-by-line.

### 8. Training export
- status: weak
- evidence: `src/training/TrainingExporter.ts`, `training/exports/`, `tests/trainingExporter.test.ts`
- risk: exports exist, but preference export can be empty and schema validation is shallow.
- required fix: add export validators and ensure every JSONL line is parseable with no empty chosen/rejected fields.

### 9. Memory approval
- status: real
- evidence: `src/memory/MemoryStore.ts`, `tests/memoryApproval.test.ts`, `tests/runtime.test.ts`
- risk: keyword retrieval is intentionally simple and can over-match.
- required fix: keep approved/expired gates and log retrieved memory; no embeddings in v0.1.

### 10. Tool governance
- status: real
- evidence: `src/tools/FileReadTool.ts`, `src/tools/FileWriteTool.ts`, `src/tools/ShellTool.ts`, `src/tools/GitTool.ts`, `tests/toolGovernance.test.ts`
- risk: tool calls are not yet fully integrated into runtime trace because v0.1 runtime does not execute tools.
- required fix: keep disabled defaults and include honest empty toolCalls in trace.

### 11. Policy compiler/adaptation
- status: weak
- evidence: `src/policy/PolicySelector.ts`, `src/policy/PolicyCompiler.ts`, `src/policy/ConflictResolver.ts`, `tests/policyEngine.test.ts`
- risk: policy selection is better than dumping all policies, but planning/tool and memory/correction conditions need sharper checks.
- required fix: make selection conditional on memory/tool/correction/refusal context and return explicit conflict resolution metadata.

### 12. Schema validation
- status: weak
- evidence: `src/schemas/zodSchemas.ts`, `src/utils/validators.ts`, `src/core/ResponsePipeline.ts`
- risk: Zod schemas exist, but runtime output validation still uses Markdown section checks for final answers.
- required fix: harden major object schemas and validate critic/repair/trace/eval records.

### 13. Trace completeness
- status: weak
- evidence: `src/schemas/RunLog.ts`, `src/core/RunLogger.ts`, latest `runs/YYYY-MM-DD/<run-id>/trace.json`
- risk: trace contains key fields but lacks providerRoles, evaluator/classifier model fields, route object, and replayable flag.
- required fix: extend RunTrace and logger payloads.

### 14. Runtime tests
- status: real
- evidence: `tests/runtime.test.ts`, `tests/runLoggingContract.test.ts`, `tests/replay.test.ts`, `tests/redteamEval.test.ts`
- risk: tests cover happy/refusal paths but need harder critic/repair/STAX atomic checks.
- required fix: add behavior tests for critic gate, repair, atomic STAX, eval critical failure, and trace role calls.

### 15. CLI commands
- status: real
- evidence: `src/cli.ts`, `package.json`, `README_RAX.md`
- risk: commands exist, but replay/corrections/train output contracts should be stricter.
- required fix: keep CLI stable while tightening returned reports and exit behavior.

## Priority Fix Order

1. Critic gate + repair enforcement
2. STAX atomic signal extraction
3. Eval strictness + critical eval enforcement
4. Provider role separation
5. Replay determinism
6. Corrections -> eval/training/golden promotion
7. Training export validity
8. Memory approval enforcement
9. Tool governance
10. Policy selection sophistication
11. Trace completeness
12. Docs and final QA

## Validation Log

- `npm install`: passed, 0 vulnerabilities.
- `npm run typecheck`: passed.
- `npm test`: passed, 26 test files and 64 tests.
- `npm run build`: passed.
- `npm run rax -- run "Extract this as STAX fitness signals: Dean trained BJJ Saturday for 90 minutes and slept 8 hours Sunday."`: passed; produced two atomic Signal Units.
- `npm run rax -- eval`: passed, 16/16, passRate 1, criticalFailures 0.
- `npm run rax -- eval --mode stax_fitness`: passed, 2/2, passRate 1, criticalFailures 0.
- `npm run rax -- eval --redteam`: passed, 9/9, passRate 1, criticalFailures 0.
- `npm run rax -- eval --regression`: passed, 6/6, passRate 1, criticalFailures 0.
- `npm run rax -- replay run-2026-04-24T19-39-28-610Z-t4fz57`: passed with exact mock replay.
- `npm run rax -- train export --sft`: passed, 7 records.
- `npm run rax -- train export --preference`: passed, 0 records because no approved correction data is currently present.

## Final Status

Label: Behavior System v0.1.

The system is still intentionally local and bounded, but the current hardening pass moved it beyond a plain MVP:

- provider roles are explicit in config and trace
- critic gate has structured severity/issue checks
- repair controller is one-pass and traceable
- STAX fitness extracts atomic signal units
- evals enforce critical failures, pass rate, forbidden patterns, and minimum signal units
- replay reports original/replay run ids and exact mock match
- corrections promote into eval, training-correction, and golden artifacts
- training export writes parseable JSONL
- memory remains approved-only
- shell/file-write/git mutation stay denied by default
- trace logs prove routing, roles, policies, model calls, validation, and replayability
