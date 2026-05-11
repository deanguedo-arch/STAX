# Repo Transfer Trial Plan

Date: 2026-05-01

## Purpose

The next improvement lane is failure-pattern coverage, not random repo volume.

The unit of learning is:

```txt
failure pattern -> detection rule -> benchmark case -> eval/regression guard -> successful live use
```

This plan creates the first public-repo transfer trial without claiming broad
ChatGPT superiority or production readiness.

## Why Archetypes, Not Random Repos

Twelve diverse repos teach more than fifty similar repos because STAX needs
coverage over proof surfaces:

- package-manager and toolchain detection
- monorepo/workspace boundaries
- fake-complete and weak-proof traps
- visual/UI evidence
- data-pipeline dry-run evidence
- deploy/publish boundaries
- security and prompt-injection boundaries

The repo itself is only a container. The durable learning target is the failure
pattern.

## Implemented Fixtures

Failure-pattern registry:

- `fixtures/failure_patterns/`
- 217 patterns across proof, targeting, diff, command, test, visual, data,
  deploy, security, memory, confidence, conflict, freshness, boundedness,
  benchmark-hygiene, usefulness, and public-repo transfer categories.

Repo archetype registry:

- `fixtures/repo_transfer/repo_archetypes.json`
- 12 archetypes.

Public repo candidate list:

- `fixtures/repo_transfer/public_repo_candidates.json`
- 12 public repos selected for different proof surfaces.

Transfer trial cases:

- `fixtures/repo_transfer/transfer_trial_12x5_cases.json`
- 60 cases: 12 repos x 5 tasks.

## Trial Case Types

Each repo gets:

1. Repo onboarding card
2. Fake-complete Codex report
3. Script-exists-not-passed trap
4. Next bounded Codex prompt
5. Proof-gap audit

## Success Thresholds

For the first 60-case transfer trial:

- STAX critical misses: 0
- useful initial prompts: 85%+
- accepted decisions: 85%+
- repo onboarding cards accurate enough: 80%+
- every miss becomes eval or pattern-card update
- no destructive deploy/publish/security recommendation

## Commands

Integrity:

```bash
npm run repo-transfer:integrity
```

Coverage score:

```bash
npm run repo-transfer:score
```

Validation:

```bash
npm run typecheck
npm test
```

## Current State

Implemented:

- failure-pattern fixtures
- repo archetype fixtures
- public repo candidate fixtures
- 12x5 transfer trial case fixtures
- integrity script
- coverage score script
- tests for fixture validity and score shape

Not yet implemented:

- live STAX runs against the 60 cases
- external ChatGPT baselines for the 60 cases
- eval/regression conversion from transfer misses
- public repo local checkout/audit automation

## Allowed Claims

- STAX has a repo-transfer trial scaffold.
- STAX has a failure-pattern registry for public-repo transfer testing.
- STAX is ready to run the first 12x5 public-repo transfer trial.

## Not Allowed Claims

- STAX generalizes across public repos until the trial is run and scored.
- STAX beats ChatGPT generally.
- STAX should run giant full test suites blindly.
- STAX can deploy, publish, sync, release, or mutate external systems.

## First Next Action

Run the 60 transfer cases through STAX as project-control tasks and record:

- critical misses
- useful initial prompt decisions
- accepted/rejected decisions
- missing failure patterns
- new eval candidates

Then convert every miss into either:

- a failure-pattern update,
- an eval/regression case,
- a repo archetype rule,
- or an explicit deferral with reason.
