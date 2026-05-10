# Active Handoff

Date: 2026-05-10

## Current Workstream

Continue STAX Core hardening after the kernel-authority and sealed-truth phases.

This handoff is for the STAX repo only:

- repo: `/Users/deanguedo/Documents/GitHub/STAX`
- branch: `main`
- remote state at handoff: `main...origin/main [ahead 3]`

Do not route this handoff into DWG, commerce, Brightspace implementation work, or new agent/mode expansion.

## Current Local Commits

These commits are local on `main` and have not been pushed yet:

```txt
07a2c80 Harden kernel truth sealing
e06aba3 Add STAX kernel truth API and adapter contract
e3052a4 Route STAX output through kernel ledger
```

## What Changed

### `e3052a4` Kernel Authority

- `processObservation` now routes through kernel ledger authority.
- `validateEventHorizon` remains only as compatibility API and delegates to the kernel.
- Stable hashing is canonicalized for object-key order and special values.
- Replay-dependent IDs are deterministic.
- Audit traces include `ledger` plus `ledgerRecordIds` and `ledgerHashes`.
- Replay signatures include ledger authority fields.
- Strict CI now runs `validate:hardened`.

### `e06aba3` Kernel Truth API

- Added sealed `KernelTruth`.
- Added `evaluateCandidate` public kernel API.
- Added `TruthSnapshot` scaffold with latest/conflict/rejection indexes.
- Added generic STAX Core adapter contract for `external_repo`, `sidecar`, `manual`, and `import` batches.
- Kept the adapter generic; no domain-specific assumptions.

### `07a2c80` Truth-Sealing Red-Team Fix

- Red-team found that symbol-branded truth could be forged by copying the hidden symbol.
- Added a failing adversarial test for copied-symbol forgery.
- Fixed `assertKernelTruth` with a private `WeakSet` of kernel-issued objects.

## Latest Validation Evidence

The following commands passed after `07a2c80`:

```bash
npm run typecheck
npm test
npm run smoke:stax
npm run rax -- eval
npm run validate:hardened
npm run validate:staxcore:strict
```

Latest observed full test count:

```txt
182 test files passed
891 tests passed
```

Strict STAX Core release gate result:

```txt
canRelease: true
doctrine score: 100/A
replay deterministic: true
replay chain valid: true
```

Latest strict release artifact:

```txt
runs/staxcore_release/2026-05-10/staxcore_release_3745ae0a-d47d-405c-a70c-46b3345fae60.json
runs/staxcore_release/2026-05-10/staxcore_release_3745ae0a-d47d-405c-a70c-46b3345fae60.md
```

## Red/Blue/Purple Result

### Red Team

- `KernelTruth` was overclaimed before `07a2c80`; copied-symbol forgery was possible.
- Durable persistent ledger/tip-hash enforcement is still missing.
- `generateSignals` still accepts plain `ValidatedEvent[]`, so direct signal generation can bypass sealed truth.
- `TruthSnapshot` is not yet full replay authority: no explicit replay signature field, supersession invariant, or history-aware conflict detection.
- Adapter batches validate shape but do not yet run through shared durable ledger history.

### Blue Team

- Main output now routes through kernel authority.
- Audit output carries ledger IDs and hashes.
- Replay is deterministic.
- Kernel-issued truth is materially harder to forge.
- Generic adapters exist without polluting STAX Core with domain assumptions.

### Purple Team Next Work

Implement in this order:

1. Durable ledger adapter with expected tip-hash enforcement.
2. `replayLedger(records)` with explicit replay signature.
3. Supersession/correction invariants.
4. Kernel-issued signal API so signals cannot be built from arbitrary `ValidatedEvent`.
5. Adapter batch processing against shared ledger history.

## Immediate Next Target

Start with durable ledger.

Minimum new code shape:

```txt
src/staxcore/kernel/durableLedger.ts
tests/staxcore/kernel/durableLedgerAdapter.test.ts
tests/staxcore/kernel/ledgerTipEnforcement.test.ts
```

Minimum behavior:

```txt
- ledger records persist across load/save boundaries
- append requires expected current tip hash
- first append requires expected tip null
- stale tip append fails
- non-tip append fails
- duplicate record id is rejected or idempotently ignored by exact same record
- sequence cannot skip
- sequence cannot reorder
- stored record hash recomputes exactly
```

Do not start with UI. Do not add agents. Do not add domain modules.

## Fresh Chat Startup Prompt

Use this exact prompt in the next Codex chat:

```txt
docs/ACTIVE_HANDOFF.md

We are continuing STAX Core hardening in /Users/deanguedo/Documents/GitHub/STAX.

First read:
- /Users/deanguedo/Documents/GitHub/STAX/docs/ACTIVE_HANDOFF.md
- /Users/deanguedo/Documents/GitHub/STAX/AGENTS.md

Then verify:
- git status --short --branch
- git log -5 --oneline

Current known state:
- main is ahead of origin/main by 3 local commits:
  - 07a2c80 Harden kernel truth sealing
  - e06aba3 Add STAX kernel truth API and adapter contract
  - e3052a4 Route STAX output through kernel ledger
- These commits are not pushed yet unless the current repo state says otherwise.

Goal:
Continue with the next STAX-only phase: durable ledger adapter with tip-hash enforcement.

Do not work on DWG, commerce, Brightspace implementation, UI, or new agents.
Do not push or promote anything without Dean explicitly approving it.

Implementation target:
- src/staxcore/kernel/durableLedger.ts
- tests/staxcore/kernel/durableLedgerAdapter.test.ts
- tests/staxcore/kernel/ledgerTipEnforcement.test.ts

Required behavior:
- ledger records persist across load/save boundaries
- append requires expected current tip hash
- first append requires expected tip null
- stale tip append fails
- non-tip append fails
- duplicate record id is rejected or idempotently ignored by exact same record
- sequence cannot skip
- sequence cannot reorder
- stored record hash recomputes exactly

After changes, run:
- npm run typecheck
- npm test
- npm run smoke:stax
- npm run rax -- eval

If integrity-path code changed, also run:
- npm run validate:hardened
- npm run validate:staxcore:strict

Commit clean local work only after gates pass. Keep the final answer short and evidence-backed.
```

## Stop Condition

The next session can stop once durable ledger tip enforcement is implemented, tested, validated, and committed locally.

Only push after Dean explicitly says to push.
