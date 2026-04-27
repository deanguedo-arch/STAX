# RAX Real Task Dogfood Report

Date: 2026-04-27

This report captures the first 15 real-task dogfood pass across `app-admissions`, `brightspacequizexporter`, and `canvas-helper`.

## Verdict

STAX got materially better through dogfooding.

The first pass showed the Problem Movement Gate was useful, but not enough. STAX still made practical mistakes:

- suggested `npm test` for `app-admissions` even though that repo has no `test` script
- mixed STAX `rax eval` evidence into `canvas-helper` proof
- repeated stored command evidence too noisily
- deferred bounded Codex prompt requests
- routed fake Codex final reports as generic workspace audits
- missed `brightspacequizexporter` tests under `src/test`

The patch fixed those specific failures.

## What Changed From The Dogfood Findings

- Workspace command evidence is filtered by linked repo path before it can support a linked-repo audit.
- STAX eval/regression command evidence is recorded under the `stax` workspace, not under the active linked repo.
- Stored command evidence is summarized instead of dumped as a long repeated list.
- If no `test` script exists, STAX no longer falls back to `npm test`; it chooses an available proof command such as `npm run build:pages`.
- `what is risky in <workspace>` now reports the highest verified repo risk, such as stale branch or dirty worktree, before asking for proof.
- Fake Codex report prompts route to `codex_report_audit`.
- Bounded Codex prompt requests create a candidate prompt from read-only repo evidence instead of deferring.
- Linked workspace audits omit STAX latest eval/run evidence so STAX proof does not masquerade as linked-repo proof.
- Repo evidence now detects tests under `src/test`.

## Trial Summary

### app-admissions

Workspace path: `/Users/deanguedo/Documents/GitHub/ADMISSION-APP`

Key proof found:

- package script: `build:pages`
- git status: `main...origin/main [behind 18]`
- no conventional test tree detected by the read-only evidence pack

Dogfood result:

- Repo risk audit now identifies stale branch as the biggest verified operating problem.
- Proof gap audit now recommends `npm run build:pages`, not nonexistent `npm test`.
- Bounded Codex prompt generation works and remains candidate-only.
- Codex final report audit correctly treats unsupported "all tests pass" as unverified.

Remaining proof debt:

- pull or otherwise reconcile the repo being 18 commits behind origin
- run `npm run build:pages`
- add or identify a real test/QA entrypoint if this repo needs stronger verification

### brightspacequizexporter

Workspace path: `/Users/deanguedo/Documents/GitHub/brightspacequizexporter`

Key proof found:

- git status has a local deletion: `D tmp/.gitkeep`
- package scripts include `test`, `build`, `ingest:ci`, `ingest:promotion-check`, and focused ingest checks
- repo evidence now detects test files under `src/test`

Dogfood result:

- Repo risk audit identifies worktree ambiguity as the biggest verified operating problem.
- Proof gap audit now reports 76 test files rather than missing the test tree.
- Bounded Codex prompt generation works and remains candidate-only.
- Codex final report audit correctly requires command output and file/diff summary.

Remaining proof debt:

- decide whether `tmp/.gitkeep` deletion is intentional
- run `npm test` or the stronger `npm run ingest:ci`
- paste command output back to STAX as command evidence

### canvas-helper

Workspace path: `/Users/deanguedo/Documents/GitHub/canvas-helper`

Key proof found:

- stored command evidence for focused checks exists
- git status is clean
- full e2e remains open verification debt
- operational docs are present under `docs/ops/`

Dogfood result:

- STAX no longer mixes its own `rax eval` evidence into `canvas-helper` proof.
- Stored command evidence is summarized.
- Proof gap audit keeps `npm run test:e2e` as the next proof step.
- Codex report audit now routes to `codex_report_audit` and asks for `npm run test:e2e`.
- Bounded Codex prompt generation works and remains candidate-only.

Remaining proof debt:

- run `npm run test:e2e`
- paste full output back to STAX
- use focused proof only for the commands it actually covered

## External Comparison Trial

The comparison command was exercised with a generic external answer:

```txt
Review the repo, run the tests, fix the issues, improve documentation, and ask Codex to implement the best next step.
```

Current limitation: `/compare external` still behaves more like a comparison-mode runtime than a strong local benchmark. It creates a governed run, but it does not yet produce the useful scoreboard needed for real STAX-vs-ChatGPT evaluation.

Next useful slice: build `LocalProblemBenchmark` only after a few more real comparisons are captured.

## External ChatGPT Baseline Trial

A sanitized external ChatGPT prompt was run against the same 15-task frame for:

- `brightspacequizexporter`
- `canvas-helper`
- `app-admissions`

The external baseline was useful because it stayed pointed at the repos and gave direct operating-risk answers:

- Brightspace: the blocking proof issue is the failed `npm run ingest:ci` gate; if the failure names missing Rollup optional dependency evidence, do not claim build/tests/ingest promotion passed.
- Canvas Helper: the Sports Wellness risk is rendered-preview uncertainty; source inspection is not enough to prove text fit, border symmetry, or SMART goals checkmark containment.
- App Admissions: the branch being behind `origin/main` is the first operating boundary; sync requires human approval before repo-health claims.

The first STAX pass lost against that baseline in several places:

- It remembered `npm run ingest:ci failed` but lost the nearby failure reason, so later answers sometimes asked to rerun the same command.
- It treated `Canvas helper` with a space as a weaker generic prompt instead of the `canvas-helper` workspace.
- It sometimes moved to generic proof commands instead of rendered-preview proof for visual workspace issues.
- It jumped to `npm run build:pages` for `app-admissions` before surfacing the stale-branch approval boundary.

## Second Dogfood Patch

The second patch fixed the failures above without mutating linked repos or adding autonomous execution:

- pasted command evidence now stores a bounded, redacted context snippet, not only the matched command phrase
- command evidence summaries are visible to the operator/audit path
- stored command summaries can preserve useful failure clues like `@rollup/rollup-darwin-arm64`
- workspace intent routing recognizes operating-risk and proof-gap language more reliably
- `Canvas helper` maps to the `canvas-helper` workspace
- visual Sports Wellness questions prefer rendered-preview evidence over generic e2e proof
- stale `app-admissions` branch state asks for human sync approval before build proof

Key smoke after the patch:

```bash
npm run rax -- chat --once "For workspace brightspacequizexporter: npm run ingest:ci failed during build. Error: Cannot find module @rollup/rollup-darwin-arm64 from node_modules/rollup/dist/native.js. Do not propose deleting node_modules or running npm install unless it is human-approved. What is the current blocker?"

npm run rax -- chat --once "What is the biggest current operating risk in brightspacequizexporter?"
```

The second command, which did not repeat the full error context, now answers from stored command evidence:

```txt
Stored command evidence says `npm run ingest:ci` failed...
The failure appears to be a dependency/install integrity blocker (@rollup/rollup-darwin-arm64 missing)...
Run `npm ls @rollup/rollup-darwin-arm64 rollup vite`...
```

This is the concrete improvement: STAX no longer forgets the useful reason behind a failed proof command as quickly, and it avoids sending Dean back through an already-known failed command loop.

## Commands Run

Implemented and checked the dogfood fix with:

```bash
npm run typecheck
npm test -- chatOperator chatOperatorReceipt problemMovementGate workspaceRepoOperator chatSession commandEvidence localEvidence
npm run rax -- chat --once "what tests exist in brightspacequizexporter and what proof is missing?"
npm run rax -- chat --once "audit this Codex final report for canvas-helper: Codex says it fixed the repo and all tests pass, but provides no file list, no diff summary, and no command output."
npm test -- tests/commandEvidence.test.ts tests/chatOperatorReceipt.test.ts tests/workspaceRepoOperator.test.ts
npm run rax -- chat --once "What is the biggest current operating risk in brightspacequizexporter?"
```

Final validation:

```txt
npm run typecheck: passed
npm test: 48 files / 224 tests passed
npm run rax -- eval: 16/16 passed
npm run rax -- eval --regression: 43/43 passed
npm run rax -- eval --redteam: 9/9 passed
```

## Honest Limits

- STAX still does not run linked-repo commands automatically.
- Human-pasted command output is useful but remains weaker than locally executed proof.
- `/compare external` is not yet a real benchmark.
- Workspaces are local operational state and remain ignored by git.
- This pass does not build Project Brain, autonomous execution, memory approval, training export, or source mutation.

## What This Information Means

The dogfood process should become the default improvement loop:

```txt
real repo task
-> STAX answer
-> observe usefulness failure
-> patch the smallest control surface
-> add regression tests
-> rerun task
```

That is how STAX improves without becoming proof theater.
