# RAX Sandbox Patch Window Report

## Purpose

Auto-Advance v0E adds the first sandbox-only patch lane.

The patch window can write only to a verified v0D sandbox, only after human approval, and only inside the packet file allowlist. It records diff evidence, refreshes the sandbox integrity manifest with patch history, and then requires post-patch proof commands.

## CLI Surface

```bash
npm run rax -- auto-advance patch-window brightspace-rollup --workspace brightspacequizexporter --sandbox-path /tmp/brightspace-sandbox --file tmp/.gitkeep --content "patched" --approve
npm run rax -- auto-advance patch-window brightspace-rollup --workspace brightspacequizexporter --sandbox-path /tmp/brightspace-sandbox --file package-lock.json --content-file /tmp/new-package-lock.json --approve
```

## Brightspace Allowed Files

```txt
package-lock.json
package.json only with explicit justification
tmp/.gitkeep
```

## Hard Blocks

```txt
no approval = no patch
no verified v0D sandbox = no patch
linked repo path = blocked
sandbox path inside linked repo = blocked
src/** = blocked
scripts/** = blocked
fixtures/** = blocked
gold/** = blocked
benchmarks/** = blocked
package.json without justification = blocked
path traversal = blocked
```

## Patch Evidence

The patch window records:

```txt
patchEvidenceId
changed files
before hash
after hash
before/after size
diff artifact path
sandbox path
linked repo path
workspace
```

Patch evidence is stored under ignored `evidence/patches/<date>/` paths, matching command evidence behavior.

## Post-Patch Proof

After a patch, the window returns the required commands:

```txt
npm ls @rollup/rollup-darwin-arm64 rollup vite
npm run build
npm run ingest:ci
```

The patch window does not run those commands itself. The existing sandbox command window must run them after the patch, using the refreshed v0D manifest.

## What v0E Does Not Do

```txt
does not patch linked repos
does not apply sandbox changes to the real repo
does not run npm install
does not run npm install --force
does not run ingest:seed-gold
does not commit
does not push
does not promote durable state
does not create a loop runner
```

## Tests

Coverage includes:

```txt
- no approval blocks patching
- invalid sandbox manifest blocks patching
- forbidden src/** patch blocks
- package.json requires explicit justification
- package.json patching works when explicitly justified
- approved package-lock sandbox patch records diff evidence
- approved patch refreshes v0D manifest patch history
- linked repo path patch attempt blocks
- CLI patch window works
- CLI command-window can run an allowlisted post-patch command after manifest refresh
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
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
                                                      passed smoke
npm run rax -- auto-advance sandbox brightspace-rollup --workspace brightspacequizexporter --sandbox-path <tmp>/brightspace-sandbox --approve --create
                                                      passed; created disposable Brightspace sandbox
npm run rax -- auto-advance patch-window brightspace-rollup --workspace brightspacequizexporter --sandbox-path <tmp>/brightspace-sandbox --file tmp/.gitkeep --content "v0e-patch-window-smoke" --approve
                                                      passed; applied sandbox-only patch, recorded diff evidence, returned proof command checkpoints
npm run rax -- auto-advance sandbox brightspace-rollup --workspace brightspacequizexporter --sandbox-path <tmp>/brightspace-sandbox --verify
                                                      passed; post-patch v0D manifest verified with 518 integrity entries
```
