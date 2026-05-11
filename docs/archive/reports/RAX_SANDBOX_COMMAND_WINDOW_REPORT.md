# RAX Sandbox Command Window Report

## Purpose

Auto-Advance v0B adds a narrow sandbox command window after the v0 approval boundary.

Given an approved work packet, STAX may evaluate exact allowlisted commands and, only when explicitly requested, run those commands in a sandbox path and record command evidence. This is a command-proof window, not a patch window.

## CLI Surface

```bash
npm run rax -- auto-advance command-window brightspace-rollup --approve
npm run rax -- auto-advance command-window brightspace-rollup --approve --execute --sandbox-path /tmp/brightspace-sandbox
```

The first command is a dry-run that previews the approved command window and does not execute anything. The second form requires both approval and an explicit sandbox path before command execution can occur.

As of Auto-Advance v0C, CLI execution also requires a valid `.stax-sandbox.json` manifest from the sandbox copy guard before the command window can run. As of v0D, that manifest must include file integrity hashes and pass copied-file verification.

As of v0E, approved sandbox patches refresh that manifest before post-patch proof commands run.

## What v0B Allows

For the Brightspace Rollup install-integrity packet, the allowed commands are:

```txt
npm ls @rollup/rollup-darwin-arm64 rollup vite
npm run build
npm run ingest:ci
```

The window records command evidence with:

```txt
command
cwd
exit code
stdout/stderr artifact paths
summary
workspace
linked repo path
```

## Hard Blocks

```txt
no approval = no command run
missing sandbox path = no execution
sandbox path equal to linked repo path = blocked
invalid sandbox integrity manifest = blocked
non-allowlisted command = blocked
hard-blocked command = blocked
npm run ingest:ci before npm run build passes = blocked
failed command = stop and report first remaining failure
```

## Not Built

```txt
no package mutation
no source edits
no fixture/gold/benchmark edits
no sandbox creation inside the command window
no sandbox patching inside the command window; sandbox patching is handled separately by the v0E patch window
no real repo apply
no promotion
no 100-loop runner
```

## Tests

Coverage includes:

```txt
- no approval blocks command execution
- exact allowlist required
- hard-blocked commands stop before runner call
- command evidence records cwd/command/exit code/summary
- failed command stops the window
- build must pass before ingest:ci
- build + ingest:ci success completes the command window
- linked repo path execution is refused
- dry-run evaluates the window without executing
- CLI execution blocks when sandbox integrity no longer verifies
```

## Validation Results

```txt
npm test -- --run tests/sandboxPatchWindow.test.ts tests/sandboxGuard.test.ts tests/sandboxCommandWindow.test.ts
                                                      passed, 3 files / 32 tests
npm run typecheck                                     passed
npm test                                              passed, 71 files / 382 tests
npm run rax -- eval                                   passed, 16/16
npm run rax -- eval --regression                      passed, 47/47
npm run rax -- eval --redteam                         passed, 9/9
npm run rax -- auto-advance patch-window brightspace-rollup --workspace brightspacequizexporter --sandbox-path <tmp>/brightspace-sandbox --file tmp/.gitkeep --content "v0e-patch-window-smoke" --approve
                                                      passed patch-window CLI smoke; post-patch manifest refreshed
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
                                                      passed smoke
```
