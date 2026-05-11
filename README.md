# STAX

Catch fake-complete AI coding work before you trust it.

STAX is a local proof gate for AI-coded work. It attaches to a repo, audits
Codex or AI coding claims against real evidence, and writes a verdict:

```txt
Accept
Provisional
Reject
Human Review
```

## What It Checks

STAX audits AI coding work against proof such as:

- git diff
- command output and exit codes
- test and build results
- screenshots or visual proof
- data validation and dry-run artifacts
- release proof and rollback requirements
- PR artifacts and review evidence
- human approval requirements

It does not treat an AI report as truth by itself.

## 5-Minute Quickstart

Install and verify the repo:

```bash
npm install
npm run typecheck
npm test
```

Attach STAX to a project:

```bash
npm run stax:attach -- --repo ../my-project
```

Write the task:

```bash
printf "Fix the composer resize bug.\n" > ../my-project/.stax/task.md
```

Let Codex work in the attached repo, then have it update:

```txt
../my-project/.stax/codex-report.md
```

Collect command evidence:

```bash
npm run stax:collect -- --repo ../my-project -- npm test
```

Run the gate:

```bash
npm run stax:gate -- --repo ../my-project
```

Read the status and next correction prompt:

```bash
npm run stax:status -- --repo ../my-project
npm run stax:next -- --repo ../my-project
```

## 60-Second Demo

Run the fake-complete demo:

```bash
bash examples/fake-complete-demo/run-demo.sh
```

It creates a throwaway repo, simulates a confident "fixed and tests passed"
report with no captured command evidence, shows STAX rejecting it, then captures
`npm test` and reruns the gate.

## Output

The gate writes:

```txt
.stax/status.md
.stax/status.json
.stax/next-codex-prompt.md
```

The status card is organized around:

```txt
Verified
Weak / Provisional
Unverified
Risk
One Next Action
Codex Prompt if needed
```

## Current Commands

The current repo exposes the proof-gate flow through npm scripts:

```bash
npm run stax:attach -- --repo <path>
npm run stax:collect -- --repo <path> -- <command>
npm run stax:gate -- --repo <path>
npm run stax:status -- --repo <path>
npm run stax:next -- --repo <path>
```

`stax:next-prompt` remains as a compatibility alias for older local workflows.

The built/installed CLI surface is:

```bash
stax attach --repo <path>
stax collect --repo <path> -- <command>
stax gate --repo <path>
stax status --repo <path>
stax next --repo <path>
```

## Core Sidecar Files

Attached repos use a local `.stax/` folder:

```txt
.stax/task.md
.stax/codex-report.md
.stax/status.md
.stax/status.json
.stax/next-codex-prompt.md
.stax/turn-contract.json
.stax/command-evidence/
```

Runtime accountability files can also exist locally:

```txt
.stax/current-turn.json
.stax/runtime/
.stax/turns/
.stax/events/
.stax/ledger.json
.stax/learning-ledger.json
```

## STAX Does Not

- write code for you
- replace Codex or another coding agent
- auto-merge, auto-push, or auto-deploy
- auto-promote memory, evals, policies, schemas, modes, training data, or source
  changes
- trust AI claims without evidence
- prove general ChatGPT superiority
- require OpenAI unless the selected provider is OpenAI

## More Docs

- [Product thesis](docs/PRODUCT.md)
- [Quickstart](docs/QUICKSTART.md)
- [Codex workflow](docs/CODEX_WORKFLOW.md)
- [Proof model](docs/PROOF_MODEL.md)
- [Proof strength gate](docs/PROOF_STRENGTH_GATE.md)
- [Commands](docs/COMMANDS.md)
- [FAQ](docs/FAQ.md)
- [Debloat map](docs/DEBLOAT_MAP.md)
