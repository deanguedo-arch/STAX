# Codex Workflow

STAX is not a replacement for Codex. It is the local proof gate around Codex
work.

The loop is:

```txt
Attach STAX.
Write the task.
Let Codex work.
Capture command evidence.
Run the gate.
Use the next prompt.
```

## Attach

Attach the sidecar to the target repo:

```bash
npm run stax:attach -- --repo ../my-project
```

This creates `.stax/` files that define the task surface, report surface, status
surface, turn contract, and command evidence folder.

## Task

Write the task in:

```txt
../my-project/.stax/task.md
```

The task should name the expected proof. Examples:

```txt
Fix the failing CSV parser test and prove it with npm test.
```

```txt
Fix the dashboard card overflow and prove it with a screenshot plus npm test.
```

## Codex Work

Codex works in the attached repo. It should read the sidecar files before
claiming completion and update:

```txt
../my-project/.stax/codex-report.md
```

The Codex report should include:

- objective
- files changed
- commands run
- command outcomes
- screenshots or visual checks when relevant
- data or release proof when relevant
- risks
- anything not run
- human approvals needed

After `stax gate`, STAX appends or updates a generated `## STAX Proof Strength`
section in this report. Codex should not edit that generated section. It is the
audit result, not Codex's own claim, and STAX strips it before the next proof
score.

STAX also writes a stable repo-tracked proof report for humans and handoffs:

```txt
../my-project/.stax/reports/latest-proof-report.md
```

That report is the durable summary. The raw Codex report remains the working
input Codex edits during a turn.

## Command Evidence

Run relevant proof commands through STAX:

```bash
npm run stax:collect -- --repo ../my-project -- npm test
```

STAX stores raw command evidence outside the attached repo:

```txt
~/.stax/evidence/<repo-id>/command-evidence/
```

The attached repo keeps only `.stax/command-evidence/*.pointer.json` files. A
pointer is not proof by itself; `stax gate` verifies the external ledger and
worktree fingerprint before accepting the command as strong local evidence.

This matters because a report saying "tests passed" is weaker than a captured
command with cwd, exit code, output, and repo context.

## Visual Evidence

Visual claims need first-class screenshot or checklist proof, not just prose in
the Codex report.

Register an existing screenshot:

```bash
npm run stax:collect-visual -- --repo ../my-project \
  --path screenshot.png \
  --description "Dashboard card after resize fix" \
  --checklist "text fits" \
  --checklist "mobile layout checked"
```

Or capture a URL with repo-local Playwright:

```bash
npm run stax:collect-visual -- --repo ../my-project \
  --url http://127.0.0.1:5173/preview \
  --viewport 1280,800 \
  --description "Rendered preview after layout fix"
```

If URL capture is unavailable, save a screenshot manually in the target repo and
use the `--path` command instead. Do not claim a visual fix is complete just
because URL capture failed or Playwright is missing.

STAX writes a visual-proof manifest under `.stax/visual-proofs/` and verifies
that the screenshot still matches the current auditable worktree during
`stax:gate`.

## Gate

Run:

```bash
npm run stax:gate -- --repo ../my-project
```

The gate compares claims to proof:

```txt
claim -> required proof -> available evidence -> verdict
```

It writes:

```txt
../my-project/.stax/status.md
../my-project/.stax/status.json
```

## Status Card

The status card answers:

```txt
What is proven?
What is weak?
What is unverified?
What is risky?
What should Codex do next?
Does a human need to decide?
```

## Next Codex Prompt

When proof is missing or weak, use:

```bash
npm run stax:next -- --repo ../my-project
```

or open:

```txt
../my-project/.stax/next-codex-prompt.md
```

That prompt is the correction pass. It should be handed back to Codex so the
next turn fixes evidence gaps instead of drifting into new architecture.

## Human Approval Boundary

STAX can say work is proven locally. It cannot approve actions that require a
human decision.

Human review remains required for:

- merges
- pushes
- deployments
- memory promotion
- eval promotion
- training-data export
- policy, schema, or mode promotion
- release claims with missing rollback or environment proof
