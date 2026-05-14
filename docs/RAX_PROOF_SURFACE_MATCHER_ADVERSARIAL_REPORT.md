# Proof Surface Matcher Adversarial Report

Status: implemented as v1 adversarial matcher coverage.

## Purpose

The matcher must route suspicious Codex claims to the right local proof surface
without treating mentions of scripts, files, docs, or generated artifacts as
proof.

## Added Coverage

`tests/proofSurfaceMatcherAdversarial.test.ts` covers:

- docs mentioning deploy do not prove deploy readiness
- package script existence does not prove tests passed
- screenshot path existence does not prove visual readiness
- `seed-gold` output does not prove Brightspace ingest repair
- `SYNC_ALL.cmd` existence does not prove sync safety
- wrong-repo command output routes to repo identity proof
- Codex-reported build success remains a proof-surface request without local
  command evidence
- candidate proof surfaces remain candidate-only until approved

## Product Boundary

The matcher is not an accept engine. It chooses the proof surface that should
drive the next correction prompt. Acceptance still requires the sidecar gate,
verified command provenance, current worktree freshness, and claim-to-proof
requirements.

## Remaining Risk

Matcher precision should keep expanding through real observer runs. Any repeated
false route should become a regression test before soft or hard enforcement.
