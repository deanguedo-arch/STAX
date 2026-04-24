# RAX Repo Audit

## Existing Stack

- Language: TypeScript.
- Package manager: npm.
- Framework/library: no application framework; local CLI/runtime modules with Zod, dotenv, OpenAI SDK, tsx, TypeScript, and Vitest.
- Build command: `npm run build`.
- Test command: `npm test`.
- Typecheck command: `npm run typecheck`.
- Current CLI/entrypoints:
  - `src/cli.ts`
  - `src/index.ts`
  - npm script: `npm run rax -- <command>`
  - compiled CLI target: `dist/src/cli.js`

## Existing Structure

- Root control/config: `AGENTS.md`, `rax.config.json`, `.env.example`, `package.json`, `tsconfig.json`, `vitest.config.ts`.
- Runtime code: `src/`, including agents, classifiers, core runtime, evaluators, memory, policy, providers, routing, safety, schemas, tools, training, validators, and utils.
- Local behavior assets: `policies/`, `modes/`, `prompts/`, `schemas/`, `goldens/`, `examples/`.
- Feedback loop folders: `evals/`, `corrections/`, `memory/`, `training/`, `runs/`, `trace/`.
- Documentation: `docs/`, `README.md`, `README_RAX.md`, `RAX_LOCAL_BLUEPRINT.md`.
- Tests: `tests/*.test.ts`.

## Existing Functionality

The repo currently implements a mock-first STAX/RAX assistant runtime foundation:

- config loading with environment override support
- mode detection and detail-level control
- risk classification and boundary decisions
- policy selection and policy compilation from Markdown policies/modes
- mock, Ollama, and OpenAI provider abstractions
- five approved agents: Intake, Analyst, Planner, Critic, Formatter
- runtime run folders with replayable traces
- CLI run, eval, replay, trace, memory, correction, policy, and training export commands
- eval/golden/redteam foundations
- correction promotion and training export foundations
- approved-only memory retrieval foundation
- disabled-by-default shell and file-write tool behavior

## Existing Tests

Test runner: Vitest.

Current test files:

- `tests/auditAndConfig.test.ts`
- `tests/boundary.test.ts`
- `tests/correctionPromotion.test.ts`
- `tests/corrections.test.ts`
- `tests/eval.test.ts`
- `tests/evalProperties.test.ts`
- `tests/instructionStack.test.ts`
- `tests/memory.test.ts`
- `tests/memoryApproval.test.ts`
- `tests/modeDetector.test.ts`
- `tests/policyEngine.test.ts`
- `tests/providers.test.ts`
- `tests/redteamEval.test.ts`
- `tests/replay.test.ts`
- `tests/risk.test.ts`
- `tests/routing.test.ts`
- `tests/runLoggingContract.test.ts`
- `tests/runtime.test.ts`
- `tests/schemaValidation.test.ts`
- `tests/staxFitnessMode.test.ts`
- `tests/toolGovernance.test.ts`
- `tests/trainingExporter.test.ts`

## Existing Risks

- Missing package scripts: no missing core scripts observed; `rax`, `typecheck`, `test`, and `build` exist.
- Missing tests: the implementation has broad coverage, but future phases should add CLI subprocess tests, batch behavior tests, and real-provider opt-in tests where safe.
- Dependency issues: OpenAI and Ollama must remain optional. Mock mode must never require API keys or network.
- Unclear entrypoints: entrypoints are clear, but both `npm run dev -- ...` and `npm run rax -- ...` exist; documentation should prefer `npm run rax -- ...`.
- Files that should not be touched casually:
  - `runs/`, `training/exports/`, and `evals/eval_results/` generated outputs
  - approved corrections/memory once real user-approved data exists
  - `AGENTS.md`, `rax.config.json`, and policy/mode files without tests
- Integration risks:
  - Treating placeholder foundations as finished production training infrastructure.
  - Overfitting to exact goldens instead of strengthening property evals.
  - Expanding agents before eval/correction quality improves.
  - Accidentally enabling shell/file-write tools by default.

## Integration Decision

Chosen path: A. integrate RAX into existing `src/`.

Reason: this repository is already a TypeScript STAX/RAX runtime scaffold with root-level config, CLI, tests, policies, modes, evals, memory, corrections, and training folders. Moving into `src/rax/`, `packages/rax-runtime/`, or a separate `rax-runtime/` would duplicate the current implementation and increase churn.

## Commands Verified

Safe inspection commands used:

- `Get-ChildItem -Force`
- `git status --short --branch`
- `Get-Content -Raw AGENTS.md`
- `Get-Content -Raw package.json`
- `rg --files -g '!node_modules/**' -g '!dist/**' -g '!runs/**' -g '!training/exports/**' -g '!evals/eval_results/**'`
- `Get-ChildItem tests -Filter *.test.ts`

Verification commands are listed in the final report for this phase.

## Final Decision

Implement and continue STAX/RAX in the existing root `src/` tree. Use `npm run rax -- ...` as the canonical CLI path and keep mock provider as the default. Future phases should be gated by `npm run typecheck`, `npm test`, relevant evals, and at least one CLI smoke run.
