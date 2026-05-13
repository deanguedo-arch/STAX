# Sidecar Upgrade Report

Status: implemented for protocol propagation.

## What Changed

- `stax:sidecar-upgrade` updates the attached repo protocol block without duplicating STAX sections in `AGENTS.md`.
- The upgrade writes `.stax/AGENT_PROTOCOL.md`, `.stax/config.json`, `.stax/prompt-contract.json`, and can generate proof-surface candidates when requested.
- Existing task, status, Codex report, next prompt, command evidence, and events are preserved.

## Commands

```bash
npm run stax:sidecar-upgrade -- --repo <path>
npm run stax:sidecar-upgrade -- --repo <path> --discover-surfaces
```

## Safety Boundary

Sidecar upgrade is a propagation tool. It does not run repo commands, approve proof surfaces, deploy, publish, sync, push, or promote repo-specific facts into global learning.

## Verification

Covered by `tests/sidecarUpgrade.test.ts`.
