# RAX Patch Proof Chain Report

## Purpose

`PatchProofChain` composes the existing sandbox guard, sandbox patch window, sandbox command window, command evidence store, and human apply packet.

It closes the sandbox-only proof path:

```txt
verify sandbox manifest
apply approved sandbox patch if supplied
record sandbox diff
refresh manifest
run allowlisted proof commands
record command evidence
produce human apply packet
```

## Brightspace Sequence

For `repair_rollup_install_integrity`, the proof sequence is:

```txt
1. verify .stax-sandbox.json
2. patch package-lock/package.json/tmp/.gitkeep only if approved and allowed
3. npm ls @rollup/rollup-darwin-arm64 rollup vite
4. npm run build
5. npm run ingest:ci only after build passes
6. output apply packet
```

## Statuses

```txt
sandbox_verified
sandbox_failed
blocked
needs_human_apply_decision
```

`sandbox_verified` requires command evidence. Missing or partial command proof cannot become verified.

## Hard Blocks

```txt
missing or invalid sandbox manifest
unrefreshed sandbox mutation
forbidden file diff
patch without approval
non-allowlisted command
ingest:ci before build proof
```

## Tests

Coverage includes:

```txt
- approved package-lock sandbox patch verifies after npm ls, build, and ingest:ci
- failed build stops before ingest:ci
- ingest:ci cannot run before build passes
- forbidden sandbox diff blocks before commands
- incomplete command proof is not sandbox_verified
- unrefreshed sandbox mutation blocks command proof
```

## What This Does Not Do

```txt
does not apply sandbox diffs to the real repo
does not commit
does not push
does not deploy
does not promote durable state
does not run non-allowlisted commands
```
