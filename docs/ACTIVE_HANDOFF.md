# Active Handoff

Date: 2026-05-12

## Current Workstream

STAX is being hardened as a local proof gate for AI-coded work. The current
priority is proof integrity, controlled rollout, and product clarity around the
attach -> collect -> gate -> status -> next prompt workflow.

This handoff is for the STAX repo only:

- repo: `/Users/deanguedo/Documents/GitHub/STAX`
- branch: `main`
- current published commit: `65f674bbc4d2d98bf033c443f37d9838065116ba`
- current published commit short id: `65f674b`
- GitHub `main` and local `main` were aligned before this handoff file was
  created
- latest pushed change: `Add protected command preflight inference`
- latest GitHub Actions job: `validate-staxcore-strict` completed `success`
- latest Actions URL:
  <https://github.com/deanguedo-arch/STAX/actions/runs/25745571249/job/75607721547>

Do not route this handoff into Brightspace implementation work, Canvas helper
UI work, new agent expansion, or broad runtime reinvention.

## Current Product Boundary

STAX should stay centered on one product sentence:

> STAX catches fake-complete AI coding work before you trust it.

The public workflow is:

```txt
stax attach
stax collect
stax gate
stax status
stax next
stax preflight
```

The proof gate answers whether the AI coding claim is supported by repo diff,
command evidence, tests, sidecar protocol compliance, proof-strength output,
and required human approval artifacts where applicable. It does not certify
general code correctness.

## Published State

The following major hardening and rollout pieces are now on GitHub `main`:

- STAX package identity is `stax@1.0.0`.
- Direct dependencies and dev dependencies are pinned.
- `validate:hardened` exists and scans source, scripts, tests, docs, and package
  files.
- Structured command execution exists and rejects shell-shaped unsafe args.
- Command-injection tests exist.
- Durable kernel ledger exists.
- Tip-hash enforcement exists.
- Kernel replay signatures exist.
- Truth snapshot supersession invariants exist.
- Signal generation requires sealed kernel truth.
- Adapter batches run through shared ledger history.
- Sidecar command evidence has worktree fingerprints, external evidence store,
  stream hashes, canonical evidence hashes, and ledger verification.
- ProofStrengthGate requires verified local STAX command provenance before
  treating command evidence as strong proof.
- Worktree fingerprinting includes tracked changes, relevant untracked/ignored
  files, and avoids broad `.gitignore`, `AGENTS.md`, or top-level `stax/**`
  exclusions.
- Product docs now position STAX as a local proof gate, not a generic AI
  assistant or agent OS.
- Rollout phase artifacts exist for the 8+ promotion plan.
- Protected-command preflight inference is implemented and pushed.

## Latest Protected-Command Preflight Patch

Commit:

```txt
65f674b Add protected command preflight inference
```

What changed:

- `StaxPreflight` infers protected boundaries from command tokens when
  `--boundary` is omitted.
- `CommandRiskPolicy` classifies local tags, tagged pushes, registry actions,
  remote automation, and sheet-export command families as protected risk.
- `stax preflight --help` documents command-boundary inference.
- Phase 6 limited-gate artifacts now include a local non-activating
  protected-command trial.
- `RolloutPhaseGate` requires that trial artifact for Phase 6.

Local proof before commit:

```txt
stax gate: Accept
proof strength: Audit-grade, 0.95
npm run typecheck: exit 0
npm test: exit 0
npm run validate:hardened: exit 0
npm run validate:staxcore:strict: exit 0
npm run smoke:stax: exit 0
npm run rax -- eval: exit 0
```

GitHub proof after push:

```txt
validate-staxcore-strict: completed / success
run: https://github.com/deanguedo-arch/STAX/actions/runs/25745571249/job/75607721547
```

## Important Remaining Work

Do these in small, test-backed slices. Do not start a giant refactor.

### 1. Claim Extraction Precision

The last sidecar gate exposed a precision issue: claim extraction can treat
normal report metadata, file paths, command names, or proof-section wording as
hard product claims.

Goal:

```txt
Real completion/readiness/validation language must still become proof-bearing
claims, but commands, file paths, evidence IDs, section headings, and explicit
non-claims should not create unrelated hard claims.
```

Suggested first task:

- Add regression tests around `decomposeClaimsFromReport`.
- Reproduce noisy cases from STAX reports:
  - command names containing `policy`, `sync`, `publish`, or `release`
  - file paths under limited-gate docs
  - `What is unverified` and `Risks` lines that describe future work, not
    completed claims
  - explicit non-claims such as "does not enable a live blocking switch"
- Tighten normalization in `src/claims/ClaimProofMapping.ts`.
- Keep the 100 claim-evasion fixture threshold green.

### 2. Sidecar Report Ergonomics

Current behavior is strict enough to work, but reports still have to be worded
carefully. After claim extraction precision improves, make sure `.stax`
generated summaries can safely include proof-strength and confidence report
references without triggering unrelated hard claims.

### 3. Limited Hard-Gate Rollout

The machinery exists, but live blocking is intentionally inactive. The next
safe rollout is one boundary only:

```txt
release/deploy/data-publish preflight boundary
```

Before enabling any live hard gate, require:

- 50+ soft-gate runs
- 3+ repos
- 0 critical false accepts
- low false-reject rate for hard-gated claim types
- approval artifact model tested
- rollback/override policy documented

### 4. Debloat

The public product surface is documented as six commands, but `package.json`
still exposes a large internal/research script surface. Debloat should be a
separate product-surface pass:

- keep public scripts small
- archive legacy script provenance
- avoid deleting working internals first
- validate after each staged cut

## Do Not Do Yet

- Do not add new agents.
- Do not add UI before CLI behavior is stable.
- Do not auto-promote memory, evals, training data, policies, or schema changes.
- Do not hard-gate ordinary local editing.
- Do not claim STAX proves code correctness.
- Do not tag or publish a release unless Dean explicitly asks for that action.

## Fresh Chat Startup Prompt

Use this exact prompt in the next Codex chat:

```txt
docs/ACTIVE_HANDOFF.md

We are continuing STAX work in /Users/deanguedo/Documents/GitHub/STAX.

First read:
- /Users/deanguedo/Documents/GitHub/STAX/docs/ACTIVE_HANDOFF.md
- /Users/deanguedo/Documents/GitHub/STAX/AGENTS.md
- /Users/deanguedo/Documents/GitHub/STAX/.stax/status.json
- /Users/deanguedo/Documents/GitHub/STAX/.stax/next-codex-prompt.md

Then verify:
- git status --short --branch
- git log -5 --oneline
- git ls-remote origin refs/heads/main

Current published baseline:
- commit: 65f674bbc4d2d98bf033c443f37d9838065116ba
- short: 65f674b
- commit message: Add protected command preflight inference
- GitHub Actions strict job: success
- CI URL: https://github.com/deanguedo-arch/STAX/actions/runs/25745571249/job/75607721547

Goal:
Continue with the next bounded STAX improvement. The highest-value next slice
is claim extraction precision so normal report metadata, file paths, command
names, and explicit non-claims do not become unrelated hard product claims.

Do not broaden the product into a generic AI runtime. Keep STAX centered on the
local proof-gate workflow: attach, collect, gate, status, next, preflight.

Before claiming completion, run:
- npm run typecheck
- npm test

If integrity-path or release-gate behavior changes, also run:
- npm run validate:hardened
- npm run validate:staxcore:strict

Use STAX sidecar proof for repo changes:
- npm run stax:collect -- --repo /Users/deanguedo/Documents/GitHub/STAX -- <command>
- npm run stax:gate -- --repo /Users/deanguedo/Documents/GitHub/STAX

Keep the final answer short and evidence-backed.
```

## Stop Condition

The protected-command preflight inference patch is published and GitHub Actions
passed. This handoff should now be committed and pushed so the next thread has a
current bootstrap file on GitHub `main`.
