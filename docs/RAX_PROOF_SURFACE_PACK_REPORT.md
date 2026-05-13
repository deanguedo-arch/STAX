# Proof Surface Pack Report

Status: implemented as local sidecar proof hints plus static seed examples.

## Model

A proof surface is a repo-local rule that maps a claim to required evidence:

- build/test claims require local command output from the target repo cwd
- visual/layout claims require rendered screenshot or checklist proof
- publish/sync/deploy claims require non-mutating preflight, target validation, and human approval
- data pipeline claims require schema, fixture, quality, or dry-run proof
- gold/fixture updates are not repair proof by themselves
- wrong-repo command output cannot verify the target repo

## Public-Safe Rule

STAX may discover proof-surface candidates locally during attach or upgrade. It must not auto-trust them. Approved sidecar proof surfaces live in `.stax/proof-surfaces.json`; candidate surfaces live in `.stax/proof-surfaces.candidate.json` and are only provisional hints.

## Seed Packs

Static packs exist for:

- `proof-surfaces/canvas-helper.json`
- `proof-surfaces/admission-app.json`
- `proof-surfaces/brightspacequizexporter.json`
- `proof-surfaces/stax.json`

These are examples and known-repo seeds, not globally promoted repo facts.

## Verification

Covered by:

- `tests/proofSurfacePack.test.ts`
- `tests/proofSurfaceMatcher.test.ts`

The matcher is intentionally separate from candidate generation so sidecar
prompts can choose repo-specific proof boundaries before falling back to generic
keywords.
