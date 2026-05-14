# Public Sidecar Attach Flow

STAX is a local proof gate for AI-coded work. The public attach flow is designed
to make one boundary obvious:

```txt
Candidate proof surface = discovered suggestion.
Approved proof surface = local sidecar rule.
Fresh gate run = current audit.
Status read = last known audit.
```

Do not treat discovered repo facts as global STAX learning. They stay local to
the attached repo unless a human deliberately promotes an abstract pattern.

## 1. Attach The Sidecar

From the STAX repo:

```bash
npm run stax:attach -- --repo <repo>
```

This creates the `.stax/` sidecar, protocol files, task/status/report files, and
local ignore rules for runtime artifacts.

## 2. Discover Proof Surfaces

Run local-only discovery:

```bash
npm run stax:discover-surfaces -- --repo <repo>
```

or during upgrade:

```bash
npm run stax:sidecar-upgrade -- --repo <repo> --discover-surfaces
```

Discovery inspects local repo files such as package scripts, workflow files,
tool scripts, config examples, and docs. It does not run repo commands, upload
repo contents, auto-promote repo facts, or approve the result.

It writes:

```txt
.stax/proof-surfaces.candidate.json
.stax/proof-surfaces.review.md
```

## 3. Review Candidate Surfaces

Open:

```txt
.stax/proof-surfaces.review.md
```

Check whether the proposed rules match the repo:

```txt
Build claims require build command output.
Test claims require local command output.
Visual claims require screenshot or checklist artifacts.
Data claims require schema, fixture, quality, or ingest proof.
Publish, sync, deploy, and release claims require preflight and approval.
Wrong-repo command evidence cannot verify this repo.
```

If a candidate is wrong, edit the candidate file or rerun discovery after fixing
the repo metadata.

## 4. Approve Or Leave Candidate-Only

Approve only after review:

```bash
npm run stax:approve-surfaces -- --repo <repo>
```

Approval copies the candidate to:

```txt
.stax/proof-surfaces.json
```

and records an event under:

```txt
.stax/events/
```

Without approval, candidate surfaces can only appear as provisional hints in
next prompts. They are not enforceable local rules.

## 5. Work Normally

Put the task in:

```txt
.stax/task.md
```

Let Codex work in the attached repo. Codex should update:

```txt
.stax/codex-report.md
```

The Codex report should say what changed, what commands ran, what passed, what
did not run, what still needs human review, and what proof is missing.

## 6. Collect Evidence

Run proof commands through STAX:

```bash
npm run stax:collect -- --repo <repo> -- npm test
npm run stax:collect -- --repo <repo> -- npm run build
```

STAX stores raw command evidence outside the repo and leaves repo-local pointers.
The gate verifies the external ledger, stream hashes, evidence hash, repo path,
cwd, branch, commit, and worktree fingerprint before treating command output as
strong local proof.

## 7. Run A Fresh Gate

Run:

```bash
npm run stax:gate -- --repo <repo>
```

This is the fresh audit. It writes:

```txt
.stax/status.md
.stax/status.json
.stax/proof_strength.json
.stax/reports/latest-proof-report.md
.stax/reports/latest-confidence-report.md
.stax/next-codex-prompt.md
```

It also appends or refreshes a generated `STAX Proof Strength` section in:

```txt
.stax/codex-report.md
```

## 8. Read Status And Next Prompt

Read the last known status:

```bash
npm run stax:status -- --repo <repo>
```

Important: status reads do not force a fresh audit. Use `stax:gate` when the
repo, report, or evidence changed.

Get the correction prompt:

```bash
npm run stax:next -- --repo <repo>
```

By default, next prompt should run the gate first. Use `--no-gate` only when you
intentionally want the last stored prompt.

## Operating Rule

Treat outcomes this way:

```txt
Accept = required claims are supported by verified evidence for this repo state.
Provisional = proof is plausible but incomplete or candidate-only.
Reject = proof is missing, stale, tampered, wrong-repo, or insufficient.
Human Review = explicit approval or judgment artifact is required.
```

Accept does not certify general code correctness. It only says the audited
claims are supported by the required proof surfaces for the current repo state.
