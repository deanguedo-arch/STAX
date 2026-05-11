# RAX Sandbox Dependency Bootstrap Report

## Purpose

The controlled sandbox operator exposed a practical blocker:

```txt
sandbox_failed
first remaining failure:
npm ls @rollup/rollup-darwin-arm64 rollup vite failed with exit code 1
```

The sandbox guard correctly skips `node_modules`, but dependency proof commands are not meaningful until the sandbox dependency tree is bootstrapped. This report adds that missing sandbox-only layer.

## What Changed

```txt
SandboxDependencyBootstrap added
SandboxDependencyBootstrapSchemas added
auto-advance bootstrap CLI added
SandboxGuard now tolerates generated node_modules/build artifacts without treating them as source mutation
SandboxGuard now allows generated node_modules symlinks only when their realpath stays inside the sandbox
SandboxGuard still blocks symlink escape from generated paths
```

## CLI

```bash
npm run rax -- auto-advance bootstrap brightspace-rollup \
  --workspace brightspacequizexporter \
  --sandbox-path <tmp>/brightspace-sandbox \
  --approve \
  --execute
```

Optional lockfile repair:

```bash
npm run rax -- auto-advance bootstrap brightspace-rollup \
  --workspace brightspacequizexporter \
  --sandbox-path <tmp>/brightspace-sandbox \
  --approve \
  --execute \
  --repair-lockfile
```

## Allowed Bootstrap Commands

```txt
npm ci
npm install --package-lock-only
npm ls @rollup/rollup-darwin-arm64 rollup vite
```

## Hard Blocks

```txt
npm install --force
npm audit fix
npm update
npm dedupe
npm run ingest:seed-gold
git push
git reset --hard
source edits
real repo apply
```

## Behavior

```txt
1. Verify sandbox manifest.
2. If node_modules is missing, plan/run npm ci in the sandbox only.
3. If lockfile repair is explicitly requested, run npm install --package-lock-only in the sandbox only.
4. Record command evidence.
5. Refresh sandbox manifest if package.json or package-lock.json changed.
6. Leave linked repo untouched.
7. Return the next proof step: npm run build, then npm run ingest:ci after build passes.
```

## Tests

```txt
tests/sandboxDependencyBootstrap.test.ts
```

Focused proof:

```txt
approval required before bootstrap
non-allowlisted commands block
npm ci runs when node_modules is missing
command evidence is recorded
package-lock repair refreshes manifest
failed bootstrap command stops on first failure
linked repo package-lock remains unchanged
```

## What This Does Not Do

```txt
does not patch source files
does not apply sandbox diffs to the linked repo
does not run broad npm install
does not allow npm install --force
does not run build or ingest itself unless those are invoked through the existing command/proof window
does not create a fully adaptive repair loop
```

## Validation Results

```txt
npm run typecheck
  passed
npm test -- --run tests/sandboxDependencyBootstrap.test.ts
  passed as part of focused governed-intelligence test run
npm test
  passed, 78 files / 421 tests after safe generated node_modules symlink coverage
npm run rax -- eval
  passed, 16/16
npm run rax -- eval --regression
  passed, 47/47
npm run rax -- eval --redteam
  passed, 10/10
npm run rax -- auto-advance sandbox brightspace-rollup --workspace brightspacequizexporter --sandbox-path /tmp/stax-bootstrap-smoke-pMIL0C/brightspace-sandbox --approve --create
  passed; disposable Brightspace sandbox created with 517 copied files and node_modules skipped
npm run rax -- auto-advance bootstrap brightspace-rollup --workspace brightspacequizexporter --sandbox-path /tmp/stax-bootstrap-smoke-pMIL0C/brightspace-sandbox --approve
  passed; dry-run planned npm ci and npm ls without executing commands
npm run rax -- auto-advance run-packet brightspace-rollup --workspace brightspacequizexporter --sandbox-path /tmp/stax-bootstrap-smoke-pMIL0C/brightspace-sandbox --approve-sandbox --bootstrap --approve-bootstrap --dry-run
  passed; verified sandbox, planned bootstrap, stopped at human decision boundary, mutatedLinkedRepo=false
npm run rax -- auto-advance bootstrap brightspace-rollup --workspace brightspacequizexporter --sandbox-path /tmp/stax-brightspace-fix-AdYNc0/brightspace-sandbox --approve --execute
  passed; npm ci and npm ls @rollup/rollup-darwin-arm64 rollup vite both passed in verified sandbox
npm run rax -- auto-advance run-packet brightspace-rollup --workspace brightspacequizexporter --sandbox-path /tmp/stax-brightspace-fix-AdYNc0/brightspace-sandbox --approve-sandbox --approve-window --max-loops 100
  passed; sandbox_verified, npm ls/build/ingest:ci all passed, mutatedLinkedRepo=false, no sandbox diff to apply
npm run typecheck
  passed after safe symlink fix
npm run rax -- eval && npm run rax -- eval --regression && npm run rax -- eval --redteam
  passed, 16/16, 47/47, 10/10
```
