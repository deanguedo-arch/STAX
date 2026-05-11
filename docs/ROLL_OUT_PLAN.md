# STAX Rollout Plan

STAX is moving from a credible internal proof-gate RC to an operationally proven
soft-gate system with a narrower, cleaner product surface.

This plan combines two requirements:

1. proof promotion must be earned by measured gates, not vibes
2. debloat must be part of each rollout phase, not a separate someday cleanup

The public product promise stays simple:

```txt
STAX catches fake-complete AI coding work before you trust it.
```

## Rollout Principles

- Do not broaden architecture until the current proof baseline is frozen.
- Unsupported claim types must never return `Accept`.
- Hard gate starts at protected boundaries, not local editing.
- Each phase must define:
  - score target
  - failure criteria
  - promotion gate
  - kill switch
  - proof artifact
- Each phase must also log:
  - workflow burden
  - internal naming leakage
  - docs or commands that should be hidden from the public path

## Shared Scorecard

Promotion between phases is based on these thresholds rather than narrative
progress:

```txt
Command provenance:          9.0 required
Worktree freshness:          8.5 required
Claim extraction:            8.0 required
Protocol compliance:         8.0 required
Next-prompt usefulness:      9.0 required
False accept control:        0 critical false accepts
False reject control:        <= 5% soft, <= 2% hard-gated claims
Product clarity:             cold-user demo success under 10 minutes
Debloat:                     public surface <= 6 commands
```

## Phase 0 - Lock Current Proof Baseline

### Goal

Freeze the current release-candidate state before adding more rollout machinery.

### Required Commands

```bash
npm ci
npm run typecheck
npm test
npm run smoke:stax
npm run rax -- eval
```

### Proof Artifacts

Create:

```txt
docs/releases/STAX_RC_CURRENT/command_proof.md
docs/releases/STAX_RC_CURRENT/known_limits.md
docs/releases/STAX_RC_CURRENT/allowed_claims.md
docs/releases/STAX_RC_CURRENT/forbidden_claims.md
```

### Score Target

```txt
Baseline validation commands: 100% pass
Known-limits coverage:        100% for current RC claims
Remote/local alignment:       100%
```

### Failure Criteria

- any required command fails
- local and `main` diverge without explanation
- current docs overclaim beyond actual command proof
- any "tests passed" or "release ready" statement exists without proof output

### Promotion Gate

Proceed only when:

- all commands pass
- proof artifacts exist
- known limitations are explicit
- allowed and forbidden claims are clearly separated

### Kill Switch

If baseline proof cannot be frozen cleanly, stop architecture work and fix the
baseline first.

### Debloat Output

Log any internal-only command, doc, or name required to explain the current RC.

## Phase 1 - Adversarial Fixture League

### Goal

Prove the gate under controlled attack before broad repo rollout.

### Fixture Set

Build a league under:

```txt
fixtures/stax_trials/
  fake_complete/
  stale_evidence/
  forged_evidence/
  wrong_repo/
  wrong_branch/
  ignored_relevant_file/
  visual_claim_no_visual_proof/
  release_claim_no_release_proof/
  human_review_missing_approval/
  vague_claim_evasion/
```

Each fixture must include:

```txt
expected verdict
expected proof gap
expected next prompt
expected reject or provisional reason
```

### Score Target

```txt
Fixture cases:               50
Critical false accepts:      0
False reject rate:           <= 5%
Next prompt actionable:      >= 90%
Claim-evasion coverage:      all required terms
```

### Failure Criteria

- any critical false accept
- claim-evasion term bypasses required proof
- next prompt is unclear or non-actionable in more than 10% of cases
- unsupported claim type returns `Accept`

### Promotion Gate

Proceed only when the fixture league meets target rates and every failure class
has either been fixed or turned into a tracked regression case.

### Kill Switch

If critical false accepts persist, stop broader rollout and expand fixtures
before touching soft gate.

### Proof Artifacts

Store:

```txt
fixtures/stax_trials/manifest.json
fixtures/stax_trials/results.json
fixtures/stax_trials/failure_report.md
```

### Debloat Output

Record any fixture setup step that depends on internal repo knowledge or hidden
script archaeology.

## Phase 2 - STAX Self-Dogfood League

### Goal

Prove that STAX works on real STAX tasks, not just controlled fixtures.

### Trial Shape

Run 20 real Codex tasks in `observer` mode on the STAX repo.

Track:

```txt
task id
claim type
Codex report
STAX verdict
human verdict
false accept
false reject
protocol compliance
bypass
next prompt usable without rewrite
time cost
```

### Score Target

```txt
Real observer tasks:         20
Critical false accepts:      0
False reject rate:           <= 10%
Protocol compliance:         >= 90%
Next prompt actionable:      >= 90%
```

### Failure Criteria

- any critical false accept
- repeated protocol failure pattern without a matching test or policy update
- next prompt routinely needs manual rewriting
- workflow burden makes normal STAX use materially slower or more confusing

### Promotion Gate

Proceed only when misses are converted into tests and observer-mode behavior is
stable across repeated real tasks.

### Kill Switch

If a failure class repeats twice, stop adding new task variety and turn that
class into a required regression test.

### Proof Artifacts

Store:

```txt
docs/releases/STAX_DOGFOOD_LEAGUE/observer_runs.json
docs/releases/STAX_DOGFOOD_LEAGUE/observer_report.md
docs/releases/STAX_DOGFOOD_LEAGUE/regression_additions.md
```

### Debloat Output

Log every moment where a normal task required internal naming, extra prompt
babysitting, or non-public command knowledge.

## Phase 3 - Claim Extraction Hardening

### Goal

Close wording-based proof evasion.

### Policy

If language implies completion, readiness, validation, success, or behavioral
correctness, STAX must classify it as a claim.

### Claim Categories

```txt
implementation
test/build/typecheck
behavior
visual
data
release/deploy
security
dependency
migration
human approval
protocol compliance
```

### Score Target

```txt
Claim-evasion fixtures:      100
High-risk false negatives:   0
False positive rate:         <= 10%
Unsupported claim accepts:   0
```

### Failure Criteria

- vague completion wording escapes proof requirements
- high-risk claims are accepted without classification
- unsupported claim types can word their way into `Accept`

### Promotion Gate

Proceed only when high-risk completion wording is consistently classified and
unsupported claims are capped at `Provisional` or `Human Review`.

### Kill Switch

If Codex can still reliably word around proof enforcement, stop soft-gate
expansion and keep hard gate off the table.

### Proof Artifacts

Store:

```txt
fixtures/stax_trials/claim_evasion_results.json
docs/releases/CLAIM_EXTRACTION_HARDENING/report.md
docs/releases/CLAIM_EXTRACTION_HARDENING/allowed_phrasing.md
```

### Debloat Output

Update public docs so users understand what kinds of claims require proof
without reading internal policy code.

## Phase 4 - Soft-Gate Trial

### Goal

Introduce consequence without turning local work into a brittle blocker system.

### Policy

```txt
Accept = proceed
Provisional = missing proof; needs correction or override
Reject = cannot accept without fix or rerun
Human Review = requires scoped approval artifact
Protocol Failure = agent did not follow STAX workflow
```

### Trial Scope

Run soft-gate trials across:

```txt
fixture repo
STAX repo
one low-risk real repo
one messy real repo
Brightspace stays observer unless stable enough to graduate
```

### Score Target

```txt
Soft-gate runs:              50
High-risk false accepts:     0
False reject rate:           <= 5% for build/test/typecheck claims
Override rate:               <= 20%
Next prompt actionable:      >= 90%
Unresolved CI/local mismatch: 0
```

### Failure Criteria

- high-risk false accepts
- overrides are routine rather than exceptional
- users cannot tell why a gate blocked
- local and CI verdicts drift without resolution

### Promotion Gate

Proceed only when soft gate is mostly right, override reasons are governable,
and the workflow remains usable without expert intervention.

### Kill Switch

If soft gate causes persistent workflow thrash, freeze expansion and fix the
highest-friction failure classes first.

### Proof Artifacts

Store:

```txt
docs/releases/SOFT_GATE_TRIAL/runs.json
docs/releases/SOFT_GATE_TRIAL/override_ledger.json
docs/releases/SOFT_GATE_TRIAL/trial_report.md
```

### Debloat Output

Any soft-gate step that forces users into internal scripts, old jargon, or
manual prompt shuffling becomes a blocking clutter defect.

## Phase 5 - Product Surface Amputation

### Goal

Raise product clarity and debloat scores by shrinking the visible interface.

### Public Surface

The public workflow should fit within:

```txt
stax attach
stax collect
stax gate
stax status
stax next
stax preflight
```

Everything else should be classified as:

```txt
internal
experimental
archive
```

### Score Target

```txt
Public commands:             <= 6
Cold-user fake-complete demo: under 10 minutes
Verdict comprehension:       users explain Accept/Provisional/Reject/Human Review correctly
Internal naming leakage:     minimal in README and quickstart path
```

### Failure Criteria

- public docs still require RAX/STAXCore/campaign history to operate STAX
- normal workflow depends on internal script drawer knowledge
- command surface remains historically noisy

### Promotion Gate

Proceed only when a cold user can complete the fake-complete demo quickly and
explain the verdict model without internal repo context.

### Kill Switch

If cleanup requires risky broad refactors, pause and prefer visibility cleanup,
archive moves, and command-surface simplification first.

### Proof Artifacts

Store:

```txt
docs/releases/PRODUCT_SURFACE_AMPUTATION/demo_checklist.md
docs/releases/PRODUCT_SURFACE_AMPUTATION/public_surface_map.md
docs/releases/PRODUCT_SURFACE_AMPUTATION/archive_map.md
```

### Debloat Output

This phase is itself the debloat promotion gate: public surface, public docs,
and public naming must all become visibly smaller and clearer.

## Phase 6 - Limited Hard Gate

### Goal

Apply hard gating only at protected boundaries where the control value is worth
the friction.

### Hard-Gate Targets

Start with:

```txt
release/deploy commands
data publish commands
required CI checks
```

Later candidates:

```txt
protected branch merge or push
```

### Hard Blocks

```txt
Reject
Protocol Failure
stale, tampered, or wrong-worktree evidence
Provisional on protected claims
Human Review without valid approval artifact
```

### Score Target

```txt
Soft-gate runs completed:    50+
Repos covered:               3+
Critical false accepts:      0
False reject rate:           <= 2% for hard-gated claim types
Approval artifact model:     tested
Rollback procedure:          tested
Override policy:             documented
```

### Failure Criteria

- hard gate blocks ordinary local work rather than protected boundaries
- approval or rollback path is unclear
- false rejects are too costly on protected claims

### Promotion Gate

Proceed only when soft gate has already proven stable and the protected-boundary
workflow is explicit, testable, and reversible.

### Kill Switch

If hard gate introduces unsafe operational friction, roll back to soft gate for
that boundary and fix the policy before trying again.

### Proof Artifacts

Store:

```txt
docs/releases/LIMITED_HARD_GATE/boundary_policy.md
docs/releases/LIMITED_HARD_GATE/override_policy.md
docs/releases/LIMITED_HARD_GATE/rollback_proof.md
docs/releases/LIMITED_HARD_GATE/trial_report.md
```

### Debloat Output

Hard gate must not expand the public product story. It should remain boundary
control infrastructure, not the day-to-day user experience.

## Review Questions

A reviewer should judge:

1. whether the phase order is disciplined enough
2. whether the score targets are concrete enough to govern promotion
3. whether the kill switches are strict enough to stop overclaiming
4. whether debloat is integrated early enough rather than postponed
5. whether hard gate starts narrowly enough to avoid performative strictness

## Short Version

```txt
1. Lock the current proof baseline.
2. Build an adversarial fixture league.
3. Dogfood STAX on itself in observer mode.
4. Harden claim extraction until wording cannot dodge proof.
5. Run measured soft-gate trials.
6. Amputate the public product surface.
7. Hard-gate only protected boundaries when the earlier evidence says it is ready.
```
