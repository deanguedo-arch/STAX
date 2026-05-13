# Real Sidecar Upgrade Trial Report

Status: passed with findings.

## Purpose

Verify that sidecar upgrade and proof-surface discovery work on real attached
repos, not only temp fixtures.

## Trial Repos

- `/Users/deanguedo/Documents/GitHub/canvas-helper`
- `/Users/deanguedo/Documents/GitHub/brightspacequizexporter`
- `/Users/deanguedo/Documents/GitHub/ADMISSION-APP`

## Trial Commands

For each available repo:

```bash
npm run stax:sidecar-upgrade -- --repo <repo> --discover-surfaces
npm run stax:status -- --repo <repo>
npm run stax:next-prompt -- --repo <repo> --no-gate
```

## Acceptance Checks

- `.stax/AGENT_PROTOCOL.md` exists and is current.
- `AGENTS.md` contains one STAX protocol block, not duplicates.
- `.stax/proof-surfaces.candidate.json` exists after discovery.
- `.stax/proof-surfaces.review.md` exists after discovery.
- Existing command evidence, status, reports, and next prompts are preserved.
- No source files are changed by sidecar upgrade.

## Result

### canvas-helper

Commands:

```bash
npm run stax:sidecar-upgrade -- --repo /Users/deanguedo/Documents/GitHub/canvas-helper --discover-surfaces
npm run stax:status -- --repo /Users/deanguedo/Documents/GitHub/canvas-helper
npm run stax:next-prompt -- --repo /Users/deanguedo/Documents/GitHub/canvas-helper --no-gate
npm run stax:next-prompt -- --repo /Users/deanguedo/Documents/GitHub/canvas-helper
```

Result:

- Sidecar upgrade exited 0.
- Candidate proof surfaces and review packet were generated.
- Existing task, Codex report, ledger, and learning ledger were preserved.
- `AGENTS.md` retained one STAX protocol block.
- The no-gate next prompt surfaced the existing stale prompt, as expected.
- A gate-backed next prompt loaded the approved proof-surface pack.
- The repo's existing sidecar status is not clean proof for the current Canvas
  work because stale command evidence and old visual/test claims remain.

### brightspacequizexporter

Commands:

```bash
npm run stax:sidecar-upgrade -- --repo /Users/deanguedo/Documents/GitHub/brightspacequizexporter --discover-surfaces
npm run stax:status -- --repo /Users/deanguedo/Documents/GitHub/brightspacequizexporter
npm run stax:next-prompt -- --repo /Users/deanguedo/Documents/GitHub/brightspacequizexporter --no-gate
```

Result:

- Sidecar upgrade exited 0.
- Candidate proof surfaces and review packet were generated.
- Existing task, Codex report, ledger, and learning ledger were preserved.
- `AGENTS.md` retained one STAX protocol block.
- Existing status was Accept for the current Brightspace sidecar proof state.
- Discovery found data/ingest and gold fixture command surfaces, including
  `npm run ingest:ci` and `npm run ingest:seed-gold`.

### ADMISSION-APP

Commands:

```bash
npm run stax:sidecar-upgrade -- --repo /Users/deanguedo/Documents/GitHub/ADMISSION-APP --discover-surfaces
npm run stax:status -- --repo /Users/deanguedo/Documents/GitHub/ADMISSION-APP
npm run stax:next-prompt -- --repo /Users/deanguedo/Documents/GitHub/ADMISSION-APP --no-gate
```

Result:

- Sidecar upgrade exited 0.
- Candidate proof surfaces and review packet were generated.
- `AGENTS.md` retained one STAX protocol block.
- Status was Provisional because no ADMISSION Codex report has been audited.
- The first trial exposed a discovery gap: sync/preflight surfaces lived in
  `.cmd`, `.bat`, and `tools/*.ps1` files rather than package scripts.
- Discovery was updated to classify local tool/script files as candidate command
  surfaces. The rerun detected publish/sync/deploy risk surfaces and preflight
  candidates such as `tools/validate-sync-surface.ps1` and
  `tools/validate-canonical.ps1`.

## Cleanup

Trial-only mutations in attached repos were removed after inspection. The real
repos ended clean except for ADMISSION-APP being behind origin/main, which was
pre-existing and not changed by this trial.

## Findings

- Real attached repos do exercise different paths than temp fixtures.
- `stax:status` prints existing sidecar status when present; it is a status
  reader, not a freshness-forcing gate run.
- `stax:next-prompt --no-gate` also reads the existing prompt. Gate-backed
  prompt generation is required when testing new matcher behavior.
- File-based command discovery is required for public portability.
