# Active Handoff

Date: 2026-05-10

## Current Workstream

STAX Core release-candidate cleanup after the kernel-authority and sealed-truth
hardening phases.

This handoff is for the STAX repo only:

- repo: `/Users/deanguedo/Documents/GitHub/STAX`
- branch: `main`
- GitHub state verified on 2026-05-10: `main` == `origin/main` at `1bbdecf`
- release-candidate cleanup work is committed locally and not pushed until
  explicitly approved

Do not route this handoff into DWG, commerce, Brightspace implementation work,
UI, or new agent/mode expansion.

Only push after Dean explicitly says to push.

## Published Hardening Commits

These implementation commits are present on GitHub `main` as of `1bbdecf`:

```txt
1bbdecf Refresh active handoff after core hardening
3f5bca1 Process adapter batches through shared ledger history
6077259 Require kernel truth for signal generation
2d7f043 Add truth snapshot supersession invariants
bfa74b9 Add kernel ledger replay signatures
b2b6dfd Add durable kernel ledger tip enforcement
c86b4da Refresh active handoff for STAX core
07a2c80 Harden kernel truth sealing
e06aba3 Add STAX kernel truth API and adapter contract
e3052a4 Route STAX output through kernel ledger
```

## What Changed In This Session

### Release-Candidate Cleanup

- Updated package identity to `stax@1.0.0` while preserving the existing `rax`
  and `stax` CLI bin aliases.
- Expanded `audit:security` from a narrow STAX Core/doc subset to scan `src/`,
  `scripts/`, `tests/`, `docs/`, and package files, while excluding generated
  release archives.
- Kept intentional fake-secret fixtures explicit and counted separately instead
  of allowing broad blind spots.
- Removed stale local-only handoff language now that the hardening commits are
  on GitHub `main`.

### `b2b6dfd` Durable Ledger Tip Enforcement

- Added `KernelDurableLedger`.
- Persisted kernel ledger records across load/save boundaries.
- Required `expectedTipHash` for every append.
- Rejected stale tip appends, non-tip appends, duplicate record ids, sequence
  gaps/reordering, and stored hash mismatches.

### `bfa74b9` Kernel Ledger Replay Signatures

- Added `replayLedger(records)`.
- Replay verifies the kernel ledger chain and returns an explicit deterministic
  `replaySignature`.
- `TruthSnapshot` now includes `replaySignature`.
- Durable ledger verification now routes through replay verification.

### `2d7f043` Supersession And Correction Invariants

- Added `correction_event` to kernel ledger events.
- `TruthSnapshot` now tracks corrections, supersession indexes,
  superseded truth ids, and active truth ids.
- Added invariant checks for correction request/approval/apply ordering,
  rejected correction application, missing truth references, future references,
  self-replacement, and double supersession.

### `6077259` Kernel-Issued Signal Boundary

- `generateSignals` now requires sealed `KernelTruth[]`.
- `generateSignalPacket` now requires sealed `KernelTruth[]`.
- Main `processObservation` path builds signals from `kernelEvaluation.truth`,
  not plain validation objects.
- Added an adversarial test proving unsealed truth-shaped objects are rejected.

### `3f5bca1` Adapter Batch Shared Ledger History

- `processObservation`, `evaluateCandidate`, and `processCandidate` now accept a
  shared `KernelLedgerWriter`.
- `processAdapterBatch` processes all observations against one shared ledger and
  returns ledger history with replay signature, root hash, record ids, hashes,
  and validity.
- Added `processAdapterBatchWithDurableLedger` for durable ledger backed adapter
  batches with load/save persistence and tip enforcement.

## Latest Validation Evidence

The following commands passed after the release-candidate cleanup:

```bash
npm ci
npm run typecheck
npm test
npm run smoke:stax
npm run rax -- eval
npm run validate:hardened
npm run validate:staxcore:strict
```

Latest observed full test count:

```txt
187 test files passed
911 tests passed
```

Latest strict STAX Core release gate result:

```txt
canRelease: true
doctrine score: 100/A
replay deterministic: true
replay chain valid: true
```

Latest strict release artifact:

```txt
runs/staxcore_release/2026-05-10/staxcore_release_4c683129-f182-4b66-a5e2-00f745fcb407.json
runs/staxcore_release/2026-05-10/staxcore_release_4c683129-f182-4b66-a5e2-00f745fcb407.md
```

## Purple Team Sequence Status

Completed in order:

1. Durable ledger adapter with expected tip-hash enforcement.
2. `replayLedger(records)` with explicit replay signature.
3. Supersession/correction invariants.
4. Kernel-issued signal API so signals cannot be built from arbitrary
   `ValidatedEvent`.
5. Adapter batch processing against shared durable ledger history.

## Remaining Caution

- The hardening sequence above is published on GitHub `main`.
- The release-candidate cleanup commit is local until Dean explicitly approves
  a push.
- Default single-observation `processObservation` still uses an in-memory ledger
  unless a shared ledger writer is supplied.
- Durable adapter processing exists, but no CLI/control surface has been added
  for selecting a durable ledger file. That is intentional: do not add UI before
  CLI/runtime policy is stable.
- History-aware conflict resolution can now use correction/supersession indexes,
  but no broad new conflict-resolution policy was promoted in this session.

## Fresh Chat Startup Prompt

Use this exact prompt in the next Codex chat:

```txt
docs/archive/handoffs/ACTIVE_HANDOFF.md

We are continuing STAX Core hardening in /Users/deanguedo/Documents/GitHub/STAX.

First read:
- /Users/deanguedo/Documents/GitHub/STAX/docs/archive/handoffs/ACTIVE_HANDOFF.md
- /Users/deanguedo/Documents/GitHub/STAX/AGENTS.md

Then verify:
- git status --short --branch
- git log -10 --oneline

Known published implementation commits:
- 1bbdecf Refresh active handoff after core hardening
- 3f5bca1 Process adapter batches through shared ledger history
- 6077259 Require kernel truth for signal generation
- 2d7f043 Add truth snapshot supersession invariants
- bfa74b9 Add kernel ledger replay signatures
- b2b6dfd Add durable kernel ledger tip enforcement

These commits are on GitHub `main` as of the 2026-05-10 verification.

Goal:
Review the completed STAX Core hardening and release-candidate cleanup, then
decide whether Dean wants to tag/push the release or do one more bounded phase.
Do not add UI. Do not add agents. Do not push, tag, or promote anything without
Dean explicitly approving it.

Recommended next bounded options:
1. Tag and push `stax-v1.0.0` only if Dean explicitly approves release publish.
2. Add a CLI/runtime control for selecting a durable kernel ledger file.
3. Add history-aware conflict-resolution policy using truth snapshot indexes.

Before claiming anything, run:
- npm run typecheck
- npm test
- npm run smoke:stax
- npm run rax -- eval

If integrity-path code changed, also run:
- npm run validate:hardened
- npm run validate:staxcore:strict

Keep the final answer short and evidence-backed.
```

## Stop Condition

The purple-team hardening list from the previous handoff has been implemented,
tested, validated, committed, and published to GitHub `main`. The
release-candidate cleanup is committed locally and not pushed.

Only push after Dean explicitly says to push.
