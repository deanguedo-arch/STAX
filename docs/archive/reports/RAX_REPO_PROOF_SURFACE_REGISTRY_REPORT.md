# RAX Repo Proof Surface Registry Report

Date: 2026-04-30

## Purpose

Phase 11 showed that STAX had strong proof discipline but still tied raw ChatGPT
too often because project_control answers were sometimes less repo-specific.
This registry adds known proof surfaces for the repos Dean is actively using,
without changing scoring rules, adding autonomy, or claiming command success.

## What Was Added

- `src/projectControl/RepoProofSurfaceSchemas.ts`
- `src/projectControl/RepoProofSurfaceRegistry.ts`
- `tests/repoProofSurfaceRegistry.test.ts`
- project_control wiring in `src/agents/AnalystAgent.ts`
- high-value tie regressions in `tests/projectControlMode.test.ts`

## Seeded Repos

### ADMISSION-APP

Known proof surfaces:

- build: `npm run build:pages`
- sync preflight: `pwsh -NoProfile -ExecutionPolicy Bypass -File ./tools/validate-sync-surface.ps1`
- Apps Script validation: `pwsh -NoProfile -ExecutionPolicy Bypass -File ./tools/validate-apps-script-structure.ps1`
- canonical validation: `pwsh -NoProfile -ExecutionPolicy Bypass -File ./tools/validate-canonical.ps1`
- required config: `config/sheets_sync.json`
- example-only config: `config/sheets_sync.json.example`

Blocked live actions without preflight:

- `SYNC_ALL.cmd`
- `PUBLISH_DATA_TO_SHEETS.bat`
- `SYNC_PROGRAMS.cmd`

### canvas-helper

Known proof surfaces:

- build: `npm run build:studio`
- typecheck: `npm run typecheck`
- course shell test: `npm run test:course-shell`
- e2e proof: `npm run test:e2e`
- scoped e2e proof: `npm run test:e2e:project`
- visual proof artifact: rendered screenshot/checklist

Boundary:

- CSS/source diffs alone do not prove rendered visual correctness.

### brightspacequizexporter

Known proof surfaces:

- dependency proof: `npm ls @rollup/rollup-darwin-arm64 rollup vite`
- build: `npm run build`
- ingest gate: `npm run ingest:ci`
- forbidden proof path: `npm run ingest:seed-gold`

Boundary:

- dependency/install repair is separate from parser/source/fixture/gold changes.
- `npm run ingest:seed-gold` is not valid proof of an ingest fix.

## What Changed In project_control

When the repo identity is known, project_control can now name exact commands,
config files, blocked live actions, proof artifacts, and stop conditions.

This does not make any command result verified. STAX still requires local
command output before claiming pass, fixed, complete, build-ready, ingest-ready,
publish-ready, or visually proven.

## Tests Added

- Registry seed coverage for ADMISSION-APP, canvas-helper, and
  brightspacequizexporter.
- High-value tie regressions:
  - `app_admissions_risk_001`
  - `app_admissions_proof_gap_002`
  - `app_admissions_bounded_prompt_003`
  - `canvas_risk_007`
  - `canvas_visual_proof_008`
  - `canvas_bounded_prompt_010`

## Not Changed

- No scoring rules changed.
- No repo mutation was added.
- No sync, deploy, publish, apply, commit, or push behavior was added.
- No command pass is claimed without local command evidence.
- No broad autonomous repair was added.

## Next Proof

Run the Phase 11/Phase B comparison again after validation. The expected
improvement is not broader confidence; it is sharper repo-specific next actions
without adding a STAX critical miss.
