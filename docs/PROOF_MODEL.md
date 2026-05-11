# STAX Proof Model

STAX audits claims against evidence.

The core question is:

```txt
Did the AI actually prove the work it claims is done?
```

## Evidence Sources

STAX can use:

- task text from `.stax/task.md`
- Codex report text from `.stax/codex-report.md`
- git branch and commit context
- git diff
- command evidence captured through `stax:collect`
- test, build, lint, and smoke output
- screenshot or visual proof
- data validation, row counts, and dry-run artifacts
- release proof and rollback notes
- PR artifacts, CI status, and review evidence
- human approval requirements

## Claim-To-Proof Mapping

Different claims need different proof.

```txt
Claim: implemented
Proof: source diff + relevant command evidence
```

```txt
Claim: bug fixed
Proof: source diff + failing path addressed + relevant test or reproduction
```

```txt
Claim: tests passed
Proof: captured command output with exit code 0
```

```txt
Claim: visual fix
Proof: rendered screenshot, visual checklist, or browser verification
```

```txt
Claim: data ready
Proof: validation command, row counts, dry run, or sample audit
```

```txt
Claim: release ready
Proof: build, test, target environment, version/tag state, and rollback boundary
```

```txt
Claim: approved
Proof: explicit human approval record
```

## Evidence Classes

### Verified

Verified means the claim is backed by relevant local proof.

Examples:

- a changed file is present in the diff
- a relevant command was captured with exit code 0
- the Codex report matches the actual repo path and task
- visual/data/release proof exists for claims that require it

### Weak / Provisional

Weak means there is partial proof, but not enough for full trust.

Examples:

- a test ran, but it is not the most relevant test
- a command passed in the right repo, but the report overstates the result
- a visual claim has a checklist but no screenshot
- release proof exists without rollback evidence

Weak proof usually leads to `Provisional` or `Human Review`.

### Unverified

Unverified means the claim is not connected to proof.

Examples:

- Codex says tests passed, but no command evidence exists
- the report says a file changed, but the diff does not show it
- the command ran in the wrong cwd or repo
- a data migration has no dry run or validation output

Unverified work usually leads to `Reject`.

### Risk

Risk means STAX found something that could make the work unsafe, misleading, or
too broad to trust automatically.

Examples:

- stale branch or commit evidence
- missing human approval
- release claim without deploy target or rollback
- dangerous command attempt
- command evidence from the wrong repo
- broad task claim with narrow proof

Risk can lead to `Reject` or `Human Review` even when some proof exists.

## Verdicts

### Accept

The work is locally proven for the task STAX was asked to gate.

Accept does not mean auto-merge, auto-push, auto-deploy, or auto-promote memory.

### Provisional

The work has useful proof, but at least one boundary remains weak.

Use Provisional when the next step is small, known, and bounded.

### Reject

The work is not proven enough to trust.

Reject should produce a concrete next prompt so Codex can collect missing proof
or fix the actual issue.

### Human Review

The work may be technically supported, but it requires a human decision.

Use Human Review for approvals, merges, releases, policy changes, memory
promotion, eval promotion, training export, or high-risk changes.

## Status Card Shape

The human-facing output should be easy to scan:

```txt
Verdict:

Verified:

Weak / Provisional:

Unverified:

Risk:

One Next Action:

Codex Prompt if needed:
```

The goal is not to produce a long report. The goal is to make the next trust
decision obvious.
