# RAX Sandbox Command Window Report

## Purpose

Auto-Advance v0B adds a narrow sandbox command window after the v0 approval boundary.

Given an approved work packet, STAX may evaluate exact allowlisted commands and, only when explicitly requested, run those commands in a sandbox path and record command evidence. This is a command-proof window, not a patch window.

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
no sandbox creation
no sandbox patching
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
```

## Validation Results

```txt
npm test -- --run tests/sandboxCommandWindow.test.ts tests/verificationEconomy.test.ts tests/commandEvidence.test.ts
                                                      passed, 3 files / 27 tests
npm run typecheck                                     passed
npm test                                              passed, 69 files / 359 tests
npm run rax -- eval                                   passed, 16/16
npm run rax -- eval --regression                      passed, 47/47
npm run rax -- eval --redteam                         passed, 9/9
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
                                                      passed smoke
npm run rax -- chat --once "/prompt For brightspacequizexporter, create one bounded Codex patch prompt to repair the dependency install blocker and prove the ingest gate."
                                                      passed smoke; top-level next step remains the bounded approval window
```
