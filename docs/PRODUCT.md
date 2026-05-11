# STAX

STAX is a local proof gate for AI-coded work.

It helps answer one question:

```txt
Did the AI actually prove the work it claims is done?
```

The short product sentence:

```txt
STAX catches fake-complete AI coding work before you trust it.
```

## What STAX Does

STAX attaches to a repo, records the task, collects command evidence, audits the
AI's report against the real repo state, and writes a verdict:

```txt
Accept
Provisional
Reject
Human Review
```

The audit checks proof such as:

- repo path, branch, cwd, and commit SHA
- git diff
- command output and exit codes
- test and build output
- screenshot or visual proof
- data validation and dry-run artifacts
- release proof and rollback requirements
- PR artifacts and review evidence
- human approval requirements

The output is a status card with:

- Verified
- Weak / Provisional
- Unverified
- Risk
- One Next Action
- Codex Prompt if needed

## Core Workflow

1. Attach STAX to a repo.
2. Put the task in `.stax/task.md`.
3. Let Codex or another AI coding agent work.
4. Codex writes `.stax/codex-report.md`.
5. Capture command evidence.
6. Run `stax gate`.
7. Read `.stax/status.md` and `.stax/status.json`.
8. Use `.stax/next-codex-prompt.md` for the correction pass.

## Public Command Surface

The product should fit in five commands:

```bash
stax attach --repo <path>
stax collect --repo <path> -- <command>
stax gate --repo <path>
stax status --repo <path>
stax next --repo <path>
```

The repo exposes this through both the built `stax` CLI and npm script aliases
while legacy `rax` routing remains available for internal commands.

## Core Files In An Attached Repo

```txt
.stax/task.md
.stax/codex-report.md
.stax/status.md
.stax/status.json
.stax/next-codex-prompt.md
.stax/turn-contract.json
.stax/command-evidence/   # repo-local pointers to external command proof
```

Runtime-only accountability files can remain local and ignored:

```txt
.stax/current-turn.json
.stax/runtime/
.stax/turns/
.stax/events/
.stax/ledger.json
.stax/learning-ledger.json
```

## Key Terms

- Proof gate: the local audit that decides whether an AI coding claim is backed
  by evidence.
- Sidecar: the `.stax/` folder and protocol attached to a target repo.
- Evidence packet: the structured record of task, repo, branch, commit, diff,
  command evidence, visual/data/release proof, PR artifacts, and approvals.
- Status card: the verdict and proof breakdown written by `stax gate`.
- Next Codex prompt: the bounded correction instruction generated when proof is
  missing or weak.
- Turn contract: the per-turn acknowledgement that proves Codex read the current
  sidecar state before claiming completion.

## STAX Does Not

- write code for you
- replace Codex or another coding agent
- auto-merge
- auto-push
- auto-deploy
- auto-promote memory, evals, policies, schemas, modes, training data, or source
  changes
- trust AI claims without evidence
- prove general ChatGPT superiority
- require OpenAI unless the selected provider is OpenAI

## Product Boundary

STAX may keep internal runtime, learning, review, release, and kernel machinery
when it improves proof gating or protects promotion boundaries.

Those internals are not the public product promise.

The public promise is:

```txt
Attach STAX.
Let AI work.
Collect proof.
Run the gate.
Trust only what is proven.
```
