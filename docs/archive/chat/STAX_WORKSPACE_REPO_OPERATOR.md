# STAX Workspace Repo Operator

The Workspace Repo Operator makes STAX chat useful against linked project repos without turning chat into a mutation surface.

It is a control surface, not a new agent.

```txt
normal repo question
-> OperationPlan
-> OperationRiskGate
-> WorkspaceContext
-> RepoEvidencePack
-> codex_audit
-> proof-backed answer
```

## Plain Language Requests

Supported examples:

```txt
audit canvas-helper
audit this repo
what tests exist in this repo?
what tests exist in canvas-helper?
what is risky in this repo?
fix this repo
```

`fix this repo` means “audit and plan the next allowed action.” It does not write to the repo.

## Evidence Pack

The operator builds a read-only evidence pack with:

- workspace / repo resolution
- safe files inspected
- source and test tree entries
- scripts and test commands from `package.json`
- missing expected files
- risks
- skipped unsafe paths
- redaction summary
- claims verified and not verified

Tests found in the repo are reported as evidence. They are not run.

## Safety Boundaries

The repo evidence reader skips:

- `node_modules`
- `.git`
- `dist`
- `build`
- `coverage`
- `.env` and `.env.*`
- secret-like paths
- key/certificate files
- symlinks
- large files
- binary files

It redacts secret-like values when they appear in otherwise safe text files.

The operator does not:

- mutate linked repos
- run shell commands in linked repos
- run linked repo tests
- approve or promote memory, evals, training records, policies, schemas, modes, or config
- silently fall back to the wrong named workspace

## Missing Named Workspace

If the user asks for `audit canvas-helper` and `canvas-helper` is not in the workspace registry, STAX does not audit another repo. It asks for setup instead.

```bash
npm run rax -- workspace create canvas-helper --repo ../canvas-helper --use
```

## Current Limits

- This is read-only evidence collection and audit planning.
- It does not execute linked repo tests.
- It does not create source patches.
- It does not open Codex handoffs automatically.
