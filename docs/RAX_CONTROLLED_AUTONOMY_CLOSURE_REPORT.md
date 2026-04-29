# RAX Controlled Autonomy Closure Report

## Purpose

This campaign closes the sandbox-only path from bounded work packet to human apply decision.

This is controlled sandbox autonomy, not real-repo autonomy.

## What Changed

```txt
SandboxPatchWindow formalized in v0E
PatchProofChain added
HumanApplyPacket added
SandboxLoopRunner added
LoopStopGate added
LoopStateStore added
auto-advance run-packet CLI added
Sandbox command-window report wording corrected
```

## Safety Gates

```txt
valid .stax-sandbox.json required before proof commands
post-patch manifest refresh required before proof commands
patches are sandbox-only
changed files are allowlist checked
forbidden file diffs block
commands are exact allowlist only
npm run build must pass before npm run ingest:ci
failed command stops the packet and reports first remaining failure
human apply packet is required before real repo apply
```

## Brightspace Packet

Allowed files:

```txt
package-lock.json
package.json only with explicit justification
tmp/.gitkeep
```

Forbidden files:

```txt
src/**
scripts/**
fixtures/**
gold/**
benchmarks/**
reviewed fixtures
```

Allowed commands:

```txt
npm ls @rollup/rollup-darwin-arm64 rollup vite
npm run build
npm run ingest:ci
```

Hard-blocked commands:

```txt
npm run ingest:seed-gold
npm install --force
git push
git reset --hard
```

## CLI

```bash
npm run rax -- auto-advance run-packet brightspace-rollup --workspace brightspacequizexporter --sandbox-path <tmp> --approve-sandbox --approve-window --max-loops 100
```

The command creates or verifies a sandbox when approved, then runs the bounded packet through the sandbox loop. If no patch content is supplied, it is a command-proof packet. If `--file` and patch content are supplied, patching is still sandbox-only and allowlist-bound.

## What Remains Impossible

```txt
real repo apply
git commit
git push
deploy/release
automatic fixture/gold edits
auto-promotion
training export
broad general-purpose patching
non-Brightspace packets
uncontrolled shell execution
```

## Tests Added

```txt
tests/humanApplyPacket.test.ts
tests/patchProofChain.test.ts
tests/sandboxLoopRunner.test.ts
```

Focused coverage:

```txt
human apply recommendations
patch-proof sequence
failed build before ingest:ci
ingest:ci build prerequisite
forbidden diff block
missing command evidence not verified
unrefreshed sandbox mutation block
loop stop conditions
run-packet CLI dry-run
run-packet CLI approved sandbox command proof
```

## Validation Results

```txt
npm run typecheck
  passed
npm test -- --run tests/humanApplyPacket.test.ts tests/patchProofChain.test.ts tests/sandboxLoopRunner.test.ts
  passed, 3 files / 18 tests
npm test -- --run tests/humanApplyPacket.test.ts tests/patchProofChain.test.ts tests/sandboxLoopRunner.test.ts tests/sandboxPatchWindow.test.ts tests/sandboxCommandWindow.test.ts tests/sandboxGuard.test.ts
  passed, 6 files / 50 tests
npm test
  passed, 74 files / 400 tests
npm run rax -- eval
  passed, 16/16
npm run rax -- eval --regression
  passed, 47/47
npm run rax -- eval --redteam
  passed, 9/9
npm run rax -- auto-advance command-window brightspace-rollup --approve
  passed, dry-run ready, no commands executed
npm run rax -- auto-advance sandbox brightspace-rollup --workspace brightspacequizexporter --sandbox-path /tmp/stax-closure-brightspace-dsRLPH/brightspace-sandbox --approve --create
  passed, created disposable Brightspace sandbox with 517 integrity files
npm run rax -- auto-advance sandbox brightspace-rollup --workspace brightspacequizexporter --sandbox-path /tmp/stax-closure-brightspace-dsRLPH/brightspace-sandbox --verify
  passed, verified sandbox manifest and file integrity
npm run rax -- auto-advance run-packet brightspace-rollup --workspace brightspacequizexporter --sandbox-path /tmp/stax-closure-brightspace-dsRLPH/brightspace-sandbox --approve-sandbox --approve-window --max-loops 100
  controlled stop, sandbox_failed; first remaining failure was npm ls @rollup/rollup-darwin-arm64 rollup vite failed with exit code 1; linked repo mutation false
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
  passed smoke
```

## Final Boundary

The campaign produces a human apply packet. It does not implement real apply. Dean remains the authority boundary for applying any sandbox diff to a linked repo.
