# RAX Controlled Autonomy Closure Report

## Purpose

This campaign closes the sandbox-only path from bounded work packet to human apply decision.

This is controlled sandbox autonomy, not real-repo autonomy.

This is now a controlled sandbox operator: a bounded packet can move through sandbox copy, sandbox patch, command proof, and human apply packet without mutating the linked repo. It is not a fully autonomous repair agent.

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
Sandbox dependency bootstrap added after the Brightspace npm ls failure exposed missing node_modules bootstrap
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
sandbox dependency bootstrap is sandbox-only and command allowlisted
generated node_modules symlinks are allowed only when their realpath stays inside the sandbox
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

Bootstrap commands allowed only in the dependency bootstrap lane:

```txt
npm ci
npm install --package-lock-only
npm ls @rollup/rollup-darwin-arm64 rollup vite
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
npm run rax -- auto-advance run-packet brightspace-rollup --workspace brightspacequizexporter --sandbox-path <tmp> --approve-sandbox --approve-window --bootstrap --approve-bootstrap --max-loops 100
```

The command creates or verifies a sandbox when approved, then runs the bounded packet through the sandbox loop. If no patch content is supplied, it is a command-proof packet. If `--file` and patch content are supplied, patching is still sandbox-only and allowlist-bound.

With `--bootstrap --approve-bootstrap`, the run packet first bootstraps sandbox dependencies through the narrow bootstrap lane before command proof.

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
fully adaptive 100-step patch idea generation
```

## Honest Limitation

`SandboxLoopRunner` is a controlled sandbox packet executor. It delegates one packet through `PatchProofChain` and stops on boundaries. It does not yet generate new patch ideas, retry intelligently, or iterate up to 100 adaptive repair attempts.

## Tests Added

```txt
tests/humanApplyPacket.test.ts
tests/patchProofChain.test.ts
tests/sandboxLoopRunner.test.ts
tests/sandboxDependencyBootstrap.test.ts
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
  passed, 78 files / 421 tests after governed-intelligence, dependency bootstrap, and safe generated symlink coverage
npm run rax -- eval
  passed, 16/16
npm run rax -- eval --regression
  passed, 47/47
npm run rax -- eval --redteam
  passed, 10/10
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
npm run rax -- auto-advance bootstrap brightspace-rollup --workspace brightspacequizexporter --sandbox-path /tmp/stax-bootstrap-smoke-pMIL0C/brightspace-sandbox --approve
  passed, dry-run planned npm ci and npm ls in verified disposable sandbox; no bootstrap commands executed
npm run rax -- auto-advance run-packet brightspace-rollup --workspace brightspacequizexporter --sandbox-path /tmp/stax-bootstrap-smoke-pMIL0C/brightspace-sandbox --approve-sandbox --bootstrap --approve-bootstrap --dry-run
  passed, integrated bootstrap dry-run verified sandbox and stopped at human decision boundary with mutatedLinkedRepo=false
npm run rax -- auto-advance bootstrap brightspace-rollup --workspace brightspacequizexporter --sandbox-path /tmp/stax-brightspace-fix-AdYNc0/brightspace-sandbox --approve --execute
  passed, npm ci and npm ls @rollup/rollup-darwin-arm64 rollup vite both passed in sandbox
npm run rax -- auto-advance run-packet brightspace-rollup --workspace brightspacequizexporter --sandbox-path /tmp/stax-brightspace-fix-AdYNc0/brightspace-sandbox --approve-sandbox --approve-window --max-loops 100
  passed, sandbox_verified; npm ls/build/ingest:ci passed; mutatedLinkedRepo=false; no sandbox diff to apply
```

## Final Boundary

The campaign produces a human apply packet. It does not implement real apply. Dean remains the authority boundary for applying any sandbox diff to a linked repo.
