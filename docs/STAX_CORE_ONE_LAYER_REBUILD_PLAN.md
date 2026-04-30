# STAX Core One-Layer Rebuild Plan

Date: 2026-04-29
Owner: Dean
Status: active

## Decision

We keep a single STAX Core layer as the truth engine.

Your posted zip + prompts are now the canonical input set for this core rebuild.

## What This Changes Us Into

From:

```txt
governance-first audit assistant
```

To:

```txt
truth-structured signal engine with provenance, uncertainty, and replay
```

And we still keep operator value by consuming core outputs in RAX workflows.

## Rebuild Scope

### In scope (Core)

```txt
ingest
structure
validate (Event Horizon)
signal
confidence
frame
context
exchange
audit trace
append-only ledger
correction event flow
```

### Out of scope for now

```txt
autonomous real-repo apply
recommendation-first behavior
UI/marketplace shells
domain expansion beyond test samples
```

## Inputs

Primary reference inputs:

```txt
/Users/deanguedo/Downloads/STAX-main-core-rebuild.zip
/Users/deanguedo/Downloads/STAX-dean-clean-core-hardening.zip
```

Input roles:

```txt
STAX-main-core-rebuild.zip:
- main snapshot context
- migration/reference source
- identifies what remains meta/operator versus core

STAX-dean-clean-core-hardening.zip:
- clean core doctrine scaffold
- target structure for one-layer STAX Core hardening
```

Prompt/audit recommendation bundle:

```txt
owner doctrine + 120-point hardening list
```

Doctrine lock for this repo:

```txt
docs/STAX_DOCTRINE_LOCK.md
docs/MIGRATION_MAP.md
```

## Phased Execution

## Phase 1 — Doctrine + Boundary Enforcement

Build:

```txt
docs/STAX_DOCTRINE_LOCK.md
docs/MIGRATION_MAP.md
tests/boundaries/importBoundary.test.ts
scripts/auditBoundaries.ts (or equivalent)
```

Gate:

```txt
No cross-layer bypass imports.
```

## Phase 2 — Core Contracts

Build:

```txt
src/types/core.ts
src/types/provenance.ts
src/types/validation.ts
src/types/confidence.ts
src/types/signal.ts
src/types/audit.ts
```

Add truth states, provenance minimum, uncertainty minimum, failure/warning taxonomy.

Gate:

```txt
All layer IO validated by runtime schema checks.
```

## Phase 3 — Event Horizon + Ledger

Build:

```txt
validateEventCandidate()
validateConflict()
validateEvidenceChain()
rejectUnsupportedTruth()
append-only ledger with immutable event ids and hash chain
```

Gate:

```txt
No mutation of validated truth.
Corrections are new events only.
```

## Phase 4 — Signal + Confidence Isolation

Build:

```txt
signal isolation from truth issuance
confidence vector scoring
confidence caps
source weighting
provisional signal behavior
```

Gate:

```txt
No confidence inflation from recommendation or narrative lanes.
```

## Phase 5 — Replay + Security + Release Gates

Build:

```txt
replay pipeline
red-team fixtures
golden fixtures
doctrine audit
security audit
boundary audit
```

Release gate:

```txt
typecheck + tests + doctrine + boundaries + security + replay pass
```

## Test Program

Must include:

```txt
complete loop test
correction loop test
attack loop test
source conflict loop test
AI uncertainty loop test
```

## Operator Compatibility Rule

RAX operator modes (`project_control`, `codex_audit`, `prompt_factory`, `control-audit`) remain active, but consume core outputs.

They must never:

```txt
bypass Event Horizon validation
mutate core truth directly
upgrade weak evidence to verified truth
```

## Immediate Next Slice

Next implementation slice should be:

```txt
Phase 10:
- run a 10-task real workflow campaign using STAX as project-control layer first
- track cleanup burden reduction, fake-complete catches, and next-prompt effectiveness
- convert repeated misses into regression/redteam eval cases
```

## Execution Status (Current)

Completed:

```txt
Phase 1:
- doctrine lock + migration map added
- import-boundary enforcement test added
- audit:doctrine, audit:boundaries, audit:security scripts wired

Phase 2 (baseline contracts/layers):
- src/staxcore/types contracts added
- src/staxcore canonical layer modules added
- processObservation API added

Phase 3 (first pass):
- Event Horizon validator expanded (conflict/evidence/rejection modeling)
- correction event model added (requested/approved/rejected/applied/superseded)
- append-only ledger extended with doctrine hash + ledger hash + chain verification + replay
- replay determinism helper added

Phase 4:
- confidence isolation strengthened with source weighting + explicit confidence caps
- no-silent-degradation behavior enforced via uncertainty/conflict output envelope fields
- doctrine loop test set added (complete/correction/attack/source conflict/AI uncertainty)

Phase 5:
- replay pipeline module added (multi-event deterministic replay + hash-chain verification)
- release gate evaluator added (typecheck/tests/doctrine/boundary/security/replay checks)
- security input normalization hardened (control-char stripping, cap, executable/secret rejection)
- red-team and golden fixture packs added with validation test coverage

Phase 6:
- staxcore CLI command added (`rax staxcore release-gate|replay|report`)
- release-gate command now runs fixed safe checks and replay in one auditable pass
- doctrine compliance scoring report added (numeric score + grade + breakdown + notes)
- release artifact writer added (`runs/staxcore_release/<date>/<artifact>.json`)
- replay + gate evidence now persisted for promotion/audit decisions

Phase 7:
- staxcore release-gate markdown packet export added for human review
- doctrine compliance trend snapshots added over recent release artifacts
- promotion-ready summary added with doctrine regression blocking
- report command now renders/refreshes markdown packet for the latest artifact

Phase 8:
- strict release profile added (`rax staxcore release-gate --strict`)
- strict profile now requires eval + regression eval + redteam eval checks
- release-gate artifacts now include profile (`standard`/`strict`) in release gate result
- markdown packet now renders release profile for audit clarity

Phase 9:
- `validate:staxcore:strict` package script added for one-command strict gate validation
- CI workflow added (`.github/workflows/staxcore-strict.yml`) to run strict gate and upload release artifacts
- strict-vs-standard guardrail doc added (`docs/STAXCORE_RELEASE_PROFILES.md`)
- CLI strict release-gate tests added to prove strict mode fails when eval flags are missing
```

Validation evidence (latest pass):

```txt
npm run typecheck
npm test
npm run audit:doctrine
npm run audit:boundaries
npm run audit:security
npm run validate:all
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
npm run rax -- eval
```
