# RAX Sandbox Copy Guard Report

## Purpose

Auto-Advance v0C adds a sandbox creation and verification guard before command execution or future patching power.

The guard creates or verifies a sandbox copy of a linked repo and records a `.stax-sandbox.json` manifest. The command window CLI now verifies that manifest before executing commands.

## CLI Surface

```bash
npm run rax -- auto-advance sandbox brightspace-rollup --workspace brightspacequizexporter --sandbox-path /tmp/brightspace-sandbox --approve --create
npm run rax -- auto-advance sandbox brightspace-rollup --workspace brightspacequizexporter --sandbox-path /tmp/brightspace-sandbox --verify
npm run rax -- auto-advance command-window brightspace-rollup --workspace brightspacequizexporter --approve --execute --sandbox-path /tmp/brightspace-sandbox
```

## Hard Blocks

```txt
no sandbox approval = no sandbox creation
missing linked repo path = blocked
source path missing/non-directory = blocked
sandbox path equals linked repo path = blocked
sandbox path inside linked repo path = blocked
non-empty target without STAX manifest = blocked
existing target with STAX manifest = blocked for create; use verify instead
command-window --execute without valid manifest = blocked
```

## Copy Guard

The sandbox copy skips:

```txt
.git
node_modules
dist
build
coverage
runs
evidence
.env*
.npmrc
*.pem
*.key
*.p12
*.pfx
symlinks
```

## What v0C Does Not Do

```txt
does not patch files
does not run commands by itself
does not apply sandbox changes to real repos
does not promote durable state
does not create a 100-loop runner
```

## Tests

Coverage includes:

```txt
- approval required before sandbox creation
- approved creation writes manifest and skips unsafe/heavy entries
- manifest verification unlocks command-window eligibility
- same-path and inside-linked-repo paths are blocked
- non-empty target without manifest is blocked
- CLI create/verify works
- CLI command-window execution blocks without sandbox proof
```

## Validation Results

```txt
npm test -- --run tests/sandboxGuard.test.ts tests/sandboxCommandWindow.test.ts
                                                      passed, 2 files / 18 tests
npm run typecheck                                     passed
npm test                                              passed, 70 files / 368 tests
npm run rax -- eval                                   passed, 16/16
npm run rax -- eval --regression                      passed, 47/47
npm run rax -- eval --redteam                         passed, 9/9
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
                                                      passed smoke
npm run rax -- workspace list                         passed; brightspacequizexporter workspace is registered
npm run rax -- auto-advance sandbox brightspace-rollup --workspace brightspacequizexporter --sandbox-path <tmp>/brightspace-sandbox --approve --create
                                                      passed; created sandbox manifest, copied 517 files, skipped .env.example, .env.local, .git, dist, node_modules
npm run rax -- auto-advance sandbox brightspace-rollup --workspace brightspacequizexporter --sandbox-path <tmp>/brightspace-sandbox --verify
                                                      passed; verified manifest and unlocked command-window eligibility
```
