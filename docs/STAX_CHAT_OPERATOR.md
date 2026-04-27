# STAX Chat Operator v1A

STAX Chat Operator v1A makes the first daily control requests work in normal language.

It is not a new agent. It is a typed router from normal chat text into existing governed STAX surfaces.

```txt
normal language
-> OperationPlan
-> OperationRiskGate
-> allowlisted backend operation
-> proof-backed answer
```

## Supported Intents

- `audit_workspace`
- `workspace_repo_audit`
- `judgment_digest`
- `audit_last_proof`
- `unknown_fallback`

## Examples

```txt
audit canvas-helper
audit this repo
what tests exist in this repo?
what is risky in canvas-helper?
fix this repo
what needs my judgment?
what did the last run prove?
```

## Boundaries

The operator does not:

- approve or promote memory, evals, training records, policies, schemas, modes, or config
- mutate source files
- write to linked external repos
- run uncontrolled shell commands
- run broad lab stress tests from vague natural language
- run eval/regression commands from vague natural language
- create Codex prompts from evidence in v1A
- perform model comparison in v1A

High-risk requests become a hard-block response. Broad artifact-heavy requests are deferred to explicit slash or CLI commands.

## Workspace Repo Operator

`workspace_repo_audit` is the first plain-English repo operator surface.

It builds a read-only evidence pack for the active workspace repo, a named workspace repo, or the current STAX repo root if no active linked workspace exists.

Supported plain-language requests include:

```txt
what tests exist in this repo?
what is risky in this repo?
what tests exist in canvas-helper?
fix this repo
```

The operator reports:

- workspace / repo resolved
- evidence checked
- files inspected
- scripts and test commands found
- claims verified
- claims not verified
- risks
- missing evidence
- next allowed action

It deliberately does not run linked repo tests, patch linked repo files, read secret-like files, or treat “fix this repo” as permission to mutate source.

Ignored or blocked repo paths include:

- `node_modules`
- `.git`
- `dist`
- `build`
- `coverage`
- `.env` and `.env.*`
- `*.pem`, `*.key`, and other secret-like paths
- symlinks
- large files and obvious binary files

## Workspace Safety

Named workspaces must exist in the workspace registry. If the user says `audit canvas-helper` and no `canvas-helper` workspace exists, STAX does not silently audit the current repo.

`audit this repo` is workspace-aware:

- if an active workspace has a linked repo path, STAX audits that active workspace repo
- if no active linked workspace exists, STAX audits the current STAX repo root and says so
- if a named workspace is missing, STAX asks for setup and does not audit another repo

Use:

```bash
npm run rax -- workspace create canvas-helper --repo ../canvas-helper --use
```

## Accepted v1A Scope

This slice intentionally replaces only the first three slash-command style workflows Dean actually needs:

- workspace/repo audit
- judgment digest
- last-run proof audit

Other natural-language operations stay deferred until this core loop proves useful.
