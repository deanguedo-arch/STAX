# Repo Proof Surface Discovery Report

Status: deterministic discovery v0 implemented.

## What It Does

`stax:discover-surfaces` inspects local repo files and writes:

```txt
.stax/proof-surfaces.candidate.json
.stax/proof-surfaces.review.md
```

The candidate is not enforced as approved truth. It can guide a next prompt as a provisional hint until a human approves it.

## Inputs

Discovery inspects local repo files only, including package scripts, common lockfiles, build/test configs, workflows, scripts, tools, top-level command files, docs, README, AGENTS, and example config files.

Command-surface discovery includes package scripts plus local script/tool files
such as `.cmd`, `.bat`, `.ps1`, and `.sh` files. This lets repos with
PowerShell or shell-based publish/sync/preflight workflows produce candidate
proof rules without adding package.json wrappers.

It skips or redacts secrets, `.env` files, dependency folders, build output, coverage, `.git`, and large binary artifacts.

## Commands

```bash
npm run stax:discover-surfaces -- --repo <path>
npm run stax:approve-surfaces -- --repo <path>
```

Approval copies the candidate to `.stax/proof-surfaces.json` and records an event under `.stax/events/`.

## Non-Goals

- no network access
- no command execution
- no source mutation
- no deploy/publish/sync authority
- no global learning promotion of repo-specific facts

## Verification

Covered by `tests/proofSurfacePack.test.ts`, `tests/proofSurfaceMatcher.test.ts`,
and `tests/sidecarUpgrade.test.ts`.
