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

## Command Evidence

Run relevant proof commands through STAX:

```bash
npm run stax:collect -- --repo ../my-project -- npm test
```

STAX records command evidence under:

```txt
../my-project/.stax/command-evidence/
```

This matters because a report saying "tests passed" is weaker than a captured
command with cwd, exit code, output, and repo context.

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
npm run stax:next-prompt -- --repo ../my-project
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
