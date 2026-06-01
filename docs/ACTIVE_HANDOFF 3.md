# Active Handoff

Date: 2026-05-19

## Current Workstream

This handoff is for continuing the STAX 8+ rollout plan from the exact point where the local-only groundwork ended.

Repo:

```txt
/Users/deanguedo/Documents/GitHub/STAX
```

Branch:

```txt
main
```

Current local commit under the working tree:

```txt
40978543f62801186c8117cded73b91f8b41b6cb
```

Current branch state before committing this work:

```txt
main...origin/main
```

Important: this handoff describes uncommitted local work in STAX. Do not reset or discard the dirty files.

## Product Boundary

STAX remains a local proof gate for AI-coded repo work.

Allowed claim:

```txt
STAX is a scoped local proof gate for Dean's Codex/repo project-control workflow.
```

Blocked claims:

```txt
broad ChatGPT superiority
production-ready autonomous agent
real repo auto-apply
git push / deploy / publish authority
arbitrary-domain superiority
code correctness proof
```

Do not broaden this work into a generic AI runtime, new agent system, deploy system, sync system, or auto-promotion loop.

## What Was Just Implemented Locally

The local-only part of the next phase is done in STAX. It deliberately did not touch `canvas-helper`, `ADMISSION-APP`, `brightspacequizexporter`, or any other attached repo.

Implemented:

- Pattern promotion impact schemas and tracker.
- `pattern:impact` runner.
- 10-case locked replay fixture.
- Cross-machine impact evidence export command.
- Current impact report.
- Current-status and archive-index updates.
- More adversarial proof-surface matcher coverage.
- Claim-extraction fix for negative `Do not:` bullet blocks.

New commands:

```bash
npm run pattern:impact
npm run pattern:impact -- --import <impact-bundle.json>
npm run stax:export-impact-evidence -- --repo <repo> --out <repo-impact.json>
```

## Files Changed

Core code:

```txt
src/learning/PatternPromotionImpactSchemas.ts
src/learning/PatternPromotionImpactTracker.ts
src/claims/ClaimProofMapping.ts
src/projectControl/ProofSurfaceMatcher.ts
src/index.ts
```

Scripts:

```txt
scripts/runPatternPromotionImpact.ts
scripts/staxExportImpactEvidence.ts
```

Fixtures and tests:

```txt
fixtures/pattern_promotion/locked_replay_10_cases.json
tests/patternPromotionImpactTracker.test.ts
tests/proofSurfaceMatcherAdversarial.test.ts
tests/sidecarClaimExtractionPrecision.test.ts
```

Docs and reports:

```txt
docs/RAX_PATTERN_PROMOTION_IMPACT_REPORT.md
docs/CURRENT_STATUS.md
docs/ARCHIVE_INDEX.md
reports/pattern_promotion/stax-impact-evidence-local.json
reports/pattern_promotion/pattern-promotion-impact-2026-05-19T16-47-32-069Z.json
```

Package/export surface:

```txt
package.json
```

Sidecar-generated local proof state is also dirty:

```txt
.stax/status.json
.stax/proof_strength.json
.stax/next-codex-prompt.md
.stax/reports/latest-proof-report.md
.stax/reports/latest-confidence-report.md
```

## Proof Already Collected

Latest local proof before this handoff file:

```txt
npm run typecheck: pass
npm test: pass, 208 files / 1075 tests
npm run smoke:stax: pass
npm run rax -- eval: pass, 16/16
npm run campaign:operating-window:today: pass, 5/5, 0 critical misses
STAX sidecar gate: Accept
Proof strength: Audit-grade (0.95)
```

Pattern impact result:

```txt
Locked replay:
- 10 cases
- 0 critical misses
- 8 improved
- 2 unchanged-safe
- 0 regressed

Current operating-window imports:
- 1 local STAX bundle
- 0 critical misses
- full handoff contract present
- proof artifact requested
```

The current operating-window section is not complete yet. It only has the local STAX bundle. The real next proof comes from the work-terminal repos.

## Important Fix From The Last Pass

Observer preflight exposed a noisy claim-extraction failure:

```txt
Do not:
- deploy, publish, sync, push, or auto-promote anything.
```

was still being interpreted as a release/deploy/config hard claim.

That is now patched in:

```txt
src/claims/ClaimProofMapping.ts
tests/sidecarClaimExtractionPrecision.test.ts
```

The new regression keeps `Do not:` bullet lists and proof-prevention wording negative.

## Work Terminal Next Steps

On the machine that has the live repos, run this for each repo you want to include in the current operating-window proof.

Target repos:

```txt
canvas-helper
ADMISSION-APP
brightspacequizexporter
STAX
```

Optional later repos:

```txt
Course-factoryPERFECT
Brightpsace-converter-project
studentbudgetwars
```

For each repo:

```bash
npm run stax:sidecar-upgrade -- --repo <repo> --discover-surfaces
npm run stax:gate -- --repo <repo>
npm run stax:next-prompt -- --repo <repo>
npm run stax:export-impact-evidence -- --repo <repo> --out <repo-impact.json>
```

Bring the exported bundles back to STAX and import them:

```bash
npm run pattern:impact -- --import <repo-impact.json>
```

For multiple bundles, pass `--import` repeatedly:

```bash
npm run pattern:impact \
  -- --import canvas-helper-impact.json \
  --import admission-app-impact.json \
  --import brightspacequizexporter-impact.json
```

## Current Acceptance Target

Minimum target for the next operating-window milestone:

```txt
10 real tasks
3 repos minimum
0 critical misses
7/10 full handoff contract present
7/10 correct proof artifact requested
cleanup prompts tracked
```

Do not count locked replay as live repo proof. Keep these claims separate:

```txt
Locked replay = proves STAX behavior changed on frozen cases.
Current operating window = proves STAX helps live repos today.
```

## What Not To Do Next

Do not:

```txt
auto-promote anything
build adaptive sandbox loop yet
run deploy / publish / sync
hard-gate live repos
mutate other repos from this STAX checkout
claim the 10-task current operating window is done
```

Adaptive sandbox packet runner comes later, after the impact tracker and current operating-window evidence are complete.

## Fresh Chat Startup Prompt

Use this exact prompt in the next Codex chat:

```txt
docs/ACTIVE_HANDOFF.md

We are continuing STAX work in /Users/deanguedo/Documents/GitHub/STAX.

First read:
- /Users/deanguedo/Documents/GitHub/STAX/docs/ACTIVE_HANDOFF.md
- /Users/deanguedo/Documents/GitHub/STAX/AGENTS.md
- /Users/deanguedo/Documents/GitHub/STAX/.stax/turn-contract.json
- /Users/deanguedo/Documents/GitHub/STAX/.stax/status.json
- /Users/deanguedo/Documents/GitHub/STAX/.stax/next-codex-prompt.md

Then verify:
- git status --short --branch
- git rev-parse HEAD
- git log -5 --oneline

Current local baseline:
- repo: /Users/deanguedo/Documents/GitHub/STAX
- branch: main
- commit under worktree: 40978543f62801186c8117cded73b91f8b41b6cb
- state: uncommitted local STAX-only phase work is present; do not reset it

Goal:
Continue from the completed local-only phase:
1. Preserve/commit the STAX impact tracker and evidence export/import work.
2. Move to the work terminal and export impact evidence from canvas-helper, ADMISSION-APP, brightspacequizexporter, and STAX.
3. Import those bundles with npm run pattern:impact.
4. Build the 10-task, 3-repo current operating-window proof.

Do not mutate attached repos from this STAX checkout unless I explicitly ask.
Do not deploy, publish, sync, hard-gate, or auto-promote anything.

Before claiming completion, run:
- npm run typecheck
- npm test
- npm run campaign:operating-window:today
- npm run pattern:impact

If claim extraction or proof-surface behavior changes, also run:
- npm test -- tests/sidecarClaimExtractionPrecision.test.ts tests/claimProofMapping.test.ts tests/proofSurfaceMatcherAdversarial.test.ts tests/patternPromotionImpactTracker.test.ts

Use STAX sidecar proof for repo changes:
- npm run stax:collect -- --repo /Users/deanguedo/Documents/GitHub/STAX -- <command>
- npm run stax:gate -- --repo /Users/deanguedo/Documents/GitHub/STAX

Keep locked replay claims separate from current operating-window claims.
Keep the final answer short and evidence-backed.
```

## Stop Condition

This handoff is complete when:

```txt
docs/ACTIVE_HANDOFF.md is current
the dirty STAX work is preserved
the next chat can start from the startup prompt
the work terminal has exact export/import commands
```
