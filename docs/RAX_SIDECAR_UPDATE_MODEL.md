# RAX Sidecar Update Model

Date: 2026-05-08

Status: implemented.

## Model

STAX has two update surfaces:

```txt
STAX repo = source of truth for CLI/runtime behavior
attached sidecar = generated control surface inside another repo
```

Updating the STAX repo improves commands such as:

```bash
npm run stax:gate
npm run stax:next-prompt
npm run stax:attach
npm run stax:harvest
```

It does not automatically rewrite every `.stax/` sidecar already installed in other repos.

## Why

Attached repos need local sidecar files for Codex operation, evidence capture, reports, ledgers, task state, and protocol text. Some of those files are generated control files. Some are repo-owned evidence and must never be deleted or blindly overwritten.

## Upgrade Command Shape

The intended future command is one of:

```bash
npm run stax:sidecar-upgrade -- --repo <path>
npm run stax:attach -- --repo <path> --upgrade
```

Either form should behave as a safe sync, not a reinstall.

## Upgrade Responsibilities

An upgrade should:

- Read the current STAX sidecar protocol version.
- Compare it with `.stax/config.json`, `.stax/AGENT_PROTOCOL.md`, and the STAX section in repo `AGENTS.md`.
- Refresh `.stax/AGENT_PROTOCOL.md`.
- Upsert the STAX section in `AGENTS.md`.
- Update safe generated schemas/config only when compatible.
- Preserve repo-specific `.stax/task.md`, `.stax/codex-report.md`, evidence files, ledgers, imports, and review state.
- Report every changed path.
- Refuse destructive cleanup unless explicitly approved.

## Implemented Command

`stax:sidecar-upgrade` now performs the safe-sync path:

- Refreshes `.stax/AGENT_PROTOCOL.md`.
- Upserts the STAX protocol section in `AGENTS.md`.
- Adds the sidecar protocol version and missing safe defaults to `.stax/config.json`.
- Ensures sidecar directories exist.
- Ensures `.stax/` is ignored.
- Creates missing control files only when absent.
- Preserves existing task, report, ledger, learning-ledger, and evidence files.
- Reports changed paths and preserved files as JSON.

`stax:attach -- --repo <path> --upgrade` routes to the same implementation.

## Non-Goals

The upgrade must not:

- Delete local evidence.
- Rewrite Codex reports.
- Promote harvested learning.
- Auto-approve memory, evals, training data, policies, schemas, or mode contracts.
- Execute target-repo commands as proof.
- Treat sidecar sync as proof that the target repo is healthy.

## Practical Rule

STAX repo updates make the tools better. Sidecar upgrade makes attached repos use the newer protocol surface. Harvest and promotion still remain separate, reviewed workflows.
