# Proof Surface Matcher Report

Status: implemented v1.

## Purpose

The proof-surface matcher chooses the most relevant repo-local proof rule for a
Codex claim before STAX writes a sidecar next prompt.

This closes the gap where a generic keyword selector could choose a broad
surface, such as `data_pipeline_ready`, when a repo-specific surface, such as
Brightspace `ingest_ready`, is the better proof boundary.

## Matching Order

The matcher scores proof surfaces using this priority:

1. blocked evidence in the repo proof surface
2. explicit command mentions
3. claim types from claim decomposition
4. repo-specific surface keywords
5. fallback repo identity boundary

## Covered Cases

- Brightspace `seed-gold` evidence maps to `ingest_ready`.
- Brightspace Rollup/package-lock/dependency claims map to `dependency_ready`.
- Canvas CSS/layout claims map to `visual_ready`.
- ADMISSION sync/publish claims map to `publish_sync_deploy_ready`.
- Wrong-repo command evidence maps to `repo_identity`.
- Codex-says-tests-passed claims map to `tests_passed`.

## Boundary

This matcher does not prove the claim. It only selects the proof surface that
should govern the next prompt or gate explanation. Command provenance, worktree
freshness, and proof strength remain separate checks.

## Validation

Covered by:

- `tests/proofSurfaceMatcher.test.ts`
- `scripts/runOperatingWindowToday.ts`

