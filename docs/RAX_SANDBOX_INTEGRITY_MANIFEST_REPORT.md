# RAX Sandbox Integrity Manifest Report

## Purpose

Auto-Advance v0D hardens sandbox trust before STAX gains any patch authority.

The sandbox guard now writes a v0D `.stax-sandbox.json` manifest with SHA-256 integrity records for every copied file. The command window can execute only after the sandbox guard verifies both the manifest metadata and copied-file integrity.

As of Auto-Advance v0E, an approved sandbox patch refreshes the v0D manifest and appends patch history so post-patch proof commands can still verify the sandbox before execution.

## What v0D Verifies

```txt
manifest guardVersion is v0D
manifest sourceRepoPath matches the linked repo
manifest sandboxPath matches the requested sandbox path
manifest packetId matches the requested packet when supplied
every copied file still exists
every copied file hash and size still match
copied files were not replaced by symlinks
unexpected source-like files are blocked
symlinks introduced after creation are blocked
manifest file paths cannot point outside the sandbox
approved sandbox patches are recorded in patchHistory
generated output paths such as dist/ and coverage/ are tolerated
```

## Why Generated Paths Are Tolerated

Command windows can produce build artifacts. Rejecting every generated file would make a successful build poison the sandbox before the next checkpoint. v0D keeps copied source/dependency files strict while allowing generated output paths that do not affect the original copied-file integrity record.

## What v0D Does Not Do

```txt
does not patch files
does not install dependencies
does not run commands by itself
does not apply sandbox changes to real repos
does not promote durable state
does not create a loop runner
```

## Tests

Coverage includes:

```txt
- v0D manifests include file hashes
- copied file mutation blocks verification
- unexpected source-like files block verification
- generated output paths are tolerated
- symlink injection blocks verification
- old v0C manifests without integrity hashes are blocked
- manifest file path traversal is blocked
- CLI command-window execution blocks when sandbox integrity no longer verifies
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
                                                      passed; created v0D sandbox manifest, copied 517 files, recorded 517 integrity hashes
npm run rax -- auto-advance sandbox brightspace-rollup --workspace brightspacequizexporter --sandbox-path <tmp>/brightspace-sandbox --verify
                                                      passed; verified manifest, copied-file hashes, and command-window eligibility
```
