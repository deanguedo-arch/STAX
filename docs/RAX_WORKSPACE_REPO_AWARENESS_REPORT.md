# RAX Workspace Repo Awareness Report

## Summary

This slice makes STAX a local command center for linked external repositories without copying STAX into those repos or mutating them. Workspace state stays inside the STAX repo. Linked repos are read-only evidence sources.

It also adds first-class command evidence artifacts for eval-style verification commands so Verified Audit can cite command output with command, exit code, redacted stdout/stderr paths, summary, and hash.

## Alignment Decisions

- `workspaces/registry.json` remains the single active workspace registry and current-workspace source.
- `WorkspaceStore` owns schema-aware workspace files and docs.
- `WorkspaceRegistry` remains as a compatibility/index API.
- `WorkspaceContext` resolves active workspace state for CLI, chat, runtime, evidence collection, and `/state`.
- `workspace create` preserves existing behavior: it activates only when no current workspace exists unless `--use` is supplied.
- Command evidence artifacts are separate from command LearningEvents. LearningEvents may link to evidence artifacts.
- Verified Audit may cite command evidence only for the exact claim it supports.

## Files Created

- `src/workspace/WorkspaceSchema.ts`
- `src/workspace/WorkspaceStore.ts`
- `src/workspace/WorkspaceContext.ts`
- `src/workspace/RepoSummary.ts`
- `src/workspace/RepoSearch.ts`
- `src/evidence/CommandEvidenceStore.ts`
- `tests/workspaceStore.test.ts`
- `tests/repoSummarySearch.test.ts`
- `tests/workspaceRuntime.test.ts`
- `tests/commandEvidence.test.ts`
- `docs/STAX_WORKSPACES.md`
- `docs/RAX_WORKSPACE_REPO_AWARENESS_REPORT.md`

## Files Modified

- `src/workspace/WorkspaceRegistry.ts`
- `src/chat/ChatSession.ts`
- `src/cli.ts`
- `src/core/RaxRuntime.ts`
- `src/core/EvalRunner.ts`
- `src/core/Replay.ts`
- `src/learning/LearningRecorder.ts`
- `src/evidence/EvidenceCollector.ts`
- `src/audit/EvidenceSufficiencyScorer.ts`
- `src/audit/VerifiedAuditContract.ts`
- `src/agents/AnalystAgent.ts`
- `src/lab/VerificationWorker.ts`
- `src/schemas/RunLog.ts`
- `src/schemas/zodSchemas.ts`
- `tests/behavior100Proof.test.ts`

## Repo Summary Example

```bash
npm run rax -- workspace repo-summary
```

Observed output includes:

```txt
## Repo Summary
- Repo: <repo-root>
- README: # STAX/RAX - Rule-Aware Adaptive Runtime ...
## Detected Stack
- Node/npm package
- TypeScript
- Vitest
## Scripts
- dev: tsx src/cli.ts
- rax: tsx src/cli.ts
- chat: tsx src/cli.ts chat
- run: tsx src/cli.ts run
- test: vitest run
- typecheck: tsc --noEmit
## Key Files
- package.json
- README.md
- tsconfig.json
- src/core/RaxRuntime.ts
- src/workspace/RepoSummary.ts
- src/evidence/CommandEvidenceStore.ts
## Tests Found
- tests/workspaceStore.test.ts
- tests/repoSummarySearch.test.ts
- tests/workspaceRuntime.test.ts
- tests/commandEvidence.test.ts
## Risks / Unknowns
```

## Search Example

```bash
npm run rax -- workspace search "RaxRuntime"
```

Observed output includes relative path, line number, snippet, and match reason:

```txt
## Workspace Search
- Query: RaxRuntime

- src/chat/ChatSession.ts:7
  Snippet: import type { RaxRuntime } from "../core/RaxRuntime.js";
  Match: case-insensitive text match
- src/cli.ts:11
  Snippet: import { createDefaultRuntime } from "./core/RaxRuntime.js";
  Match: case-insensitive text match
- src/core/RaxRuntime.ts:31
  Snippet: export type RaxRuntimeOptions = {
  Match: case-insensitive text match
```

## Trace Workspace Example

```json
{
  "runId": "run-2026-04-26T13-17-27-248Z-tnlp2s",
  "workspace": "demo",
  "linkedRepoPath": "<repo-root>"
}
```

## LearningEvent Workspace Example

```json
{
  "runId": "run-2026-04-26T13-17-27-248Z-tnlp2s",
  "workspace": "demo"
}
```

## Command Evidence Example

```json
{
  "commandEvidenceId": "cmd-ev-20260426131648865-4wnfyu",
  "command": "npm run rax -- eval --regression",
  "exitCode": 0,
  "stdoutPath": "evidence/commands/2026-04-26/cmd-ev-20260426131648865-4wnfyu.stdout.txt",
  "stderrPath": "evidence/commands/2026-04-26/cmd-ev-20260426131648865-4wnfyu.stderr.txt",
  "summary": "regression evals: 28/28 passed, failed=0, criticalFailures=0.",
  "hash": "c3abfba7a064f14218fa0934be34afcc3785dfd972c45fea84434bf56842c4db"
}
```

## Verified Audit Citation Example

```txt
Regression evals passed. Evidence: cmd-ev-20260426131648865-4wnfyu.
```

This supports the eval result claim only. It does not automatically prove feature completeness or linked repo behavior.

## Validation Results

All validation below was run locally on April 26, 2026 after the final source edit.

```txt
npm run typecheck
Result: pass
```

```txt
npm test
Result: pass
Test Files: 41 passed (41)
Tests: 145 passed (145)
```

```txt
npm run rax -- workspace create demo --repo .
Result: pass
Created workspace demo with repoPath "." and linkedRepoPath resolved to the local STAX repo root.
```

```txt
npm run rax -- workspace use demo
Result: pass
Active workspace persisted as demo.
```

```txt
npm run rax -- workspace status
Result: pass
current: demo
repoPath: .
linkedRepoPath: <repo-root>
```

```txt
npm run rax -- workspace list
Result: pass
Included current workspace demo.
```

```txt
npm run rax -- workspace show demo
Result: pass
Showed workspace.json fields, including repoPath and approved=true.
```

```txt
npm run rax -- workspace repo-summary
Result: pass
Included required sections: Repo Summary, Detected Stack, Scripts, Key Files, Tests Found, Risks / Unknowns.
```

```txt
npm run rax -- workspace search "RaxRuntime"
Result: pass
Returned source/test snippets from linked repo and ignored unsafe folders.
```

```txt
npm run rax -- evidence collect --workspace current
Result: pass
Wrote evidence/collections/evidence_20260426131713_jjpo.json.
Included workspace docs, repo_summary evidence, trace/run evidence, eval evidence, and command_output evidence.
```

```txt
npm run rax -- chat --once "/workspace repo-summary"
Result: pass
Returned the same read-only repo summary through the chat alias.
```

```txt
npm run rax -- chat --once "/state"
Result: pass
Included active workspace context demo and repo-summary context.
Run: run-2026-04-26T13-17-27-248Z-tnlp2s.
```

```txt
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
Result: pass
Preserved explicit stax_fitness signal extraction behavior.
Run: run-2026-04-26T13-17-13-184Z-3osoe2.
```

```txt
npm run rax -- eval
Result: pass
total=16 passed=16 failed=0 passRate=1 criticalFailures=0
Command evidence: cmd-ev-20260426131648239-zre31t
```

```txt
npm run rax -- eval --regression
Result: pass
total=28 passed=28 failed=0 passRate=1 criticalFailures=0
Command evidence: cmd-ev-20260426131648865-4wnfyu
```

```txt
npm run rax -- eval --redteam
Result: pass
total=9 passed=9 failed=0 passRate=1 criticalFailures=0
Command evidence: cmd-ev-20260426131648039-m1qtfi
```

## Test Coverage Added

- Workspace create/use/status/list/show behavior, including repo paths and active workspace persistence.
- Invalid repo path failure.
- Repo summary on current repo, missing package.json, ignored folders, and `.env` exclusion.
- Repo search source matches, ignored folders, `.env` exclusion, and missing repo path error.
- Runtime/chat trace workspace metadata, LearningEvent workspace metadata, and thread workspace persistence.
- `/state` workspace docs and repo-summary context fallback behavior.
- Command evidence creation, stdout/stderr recording, hash creation, redaction, and Verified Audit citation eligibility.
- Evidence collection of command evidence and workspace repo summary without ignored folders/secrets.

## Limitations

- Linked repo access is read-only and intentionally does not run linked repo tests.
- Search is simple bounded text search, not an embedding index.
- Workspace context is recorded for active STAX runs, not as durable memory.
- Command evidence stores redacted/truncated command output; it does not replace human approval.
- Runtime validation artifacts under `runs/`, `evals/eval_results/`, `learning/`, `evidence/`, and `workspaces/` remain ignored by existing repo policy. The pushed branch contains source, tests, and docs; local generated artifacts are cited here as validation output.
