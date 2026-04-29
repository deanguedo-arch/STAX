# RAX Sandbox Loop Runner Report

## Purpose

`SandboxLoopRunner` is the first loop shell for controlled sandbox work. It does not create broad autonomy. It delegates proof to `PatchProofChain` and stops on explicit boundaries.

Modes:

```txt
dry_run
sandbox_commands
sandbox_patch
```

## Loop States

```txt
planning
sandbox_ready
patch_attempted
commands_running
sandbox_verified
blocked
needs_human_decision
failed
done
```

## Stop Conditions

```txt
goal_verified
forbidden_diff
non_allowlisted_command
failed_command
same_next_step_repeated_3_times
two_patch_failures
needs_human_decision
max_loops_reached
```

## Budgets

Defaults:

```txt
maxLoops: 100
maxPatchAttempts: 3
maxCommands: 20
maxTouchedFiles: 3
maxConsecutiveFailures: 2
```

The runner reports `mutatedLinkedRepo: false` and has no real-apply path.

## CLI Surface

```bash
npm run rax -- auto-advance run-packet brightspace-rollup \
  --workspace brightspacequizexporter \
  --sandbox-path /tmp/brightspace-sandbox \
  --approve-sandbox \
  --approve-window \
  --max-loops 100
```

With `--dry-run`, it does not create a sandbox, execute commands, or patch files.

With approval, it can create or verify a sandbox, run allowlisted command proof, and optionally apply an approved sandbox patch if `--file` plus `--content` or `--content-file` are supplied.

## Tests

Coverage includes:

```txt
- 100 dry-run budget does not mutate linked repo files
- verified goal stops early and returns a human apply packet
- repeated same step three times stops
- two patch failures stop
- failed command stops the command loop
- forbidden diff stops the patch loop
- CLI dry-run does not execute
- CLI approved command proof runs only inside sandbox
```

## What This Does Not Do

```txt
does not apply to the real repo
does not commit
does not push
does not deploy
does not promote durable state
does not run arbitrary commands
does not create general-purpose patching
```
