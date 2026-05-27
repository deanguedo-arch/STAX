# Active Handoff

Date: 2026-05-27

## Current Workstream

Continue the STAX rollout from the current pushed `main` state.

Repo:

```txt
/Users/deanguedo/Documents/GitHub/STAX
```

Branch:

```txt
main
```

Latest pushed rollout commit before this handoff refresh:

```txt
58407fefaa961453429e49bd602dd2142af2e184
```

Commit message:

```txt
Refresh ADMISSION impact evidence
```

GitHub Actions proof:

```txt
staxcore-strict: completed / success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26532696033
```

Local `main` and `origin/main` were aligned when this handoff was refreshed.

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

## What Just Landed

The STAX repo is current and pushed.

Recent pushed commits include:

```txt
4d806df Serialize visual proof manifest writes
b1d734d Record Canvas impact evidence import
fc10f3d Refresh rollout handoff status
58407fe Refresh ADMISSION impact evidence
```

The latest work:

- Excluded generated runtime/export artifacts from sidecar worktree fingerprints while keeping real source/test/config changes auditable.
- Added regression coverage for generated export and Python bytecode fingerprint behavior.
- Serialized visual-proof manifest writes so concurrent visual proof collection cannot corrupt `.stax/visual-proofs/manifest.json`.
- Added regression coverage for concurrent visual proof collection.
- Refreshed `canvas-helper` current-head proof on this workstation.
- Exported the fresh Canvas operating-window impact bundle.
- Rebuilt the pattern-promotion impact report with STAX, ADMISSION-APP, and Canvas imports.
- Updated the ADMISSION-APP sidecar visual-proof protocol wording and pushed it to ADMISSION-APP `main`.
- Refreshed the ADMISSION-APP impact bundle against clean head `22acdc54747b16a9008e9ecc532806707323add9`.

## Current Canvas Helper State

The local `canvas-helper` checkout is now current on this workstation.

Canvas latest pushed commit:

```txt
d59dc393cf6f102a150716ca4ce20f53e968e119
```

Canvas GitHub Pages proof:

```txt
pages build and deployment: completed / success
run: https://github.com/deanguedo-arch/canvas-helper/actions/runs/26532152321
```

Canvas STAX sidecar gate:

```txt
verdict: Accept
proof strength: Audit-grade
commit: d59dc393cf6f102a150716ca4ce20f53e968e119
```

Fresh Canvas evidence collected on `d59dc393`:

```txt
cmd_2026-05-27T18_59_48_957Z_0c3d6942392c: AS30 shell regression test, exit 0
cmd_2026-05-27T18_59_59_902Z_a31f5f3af22a: AS30 project verify, exit 0
cmd_2026-05-27T19_00_13_504Z_3103b2923da9: AS30 project e2e, exit 0
cmd_2026-05-27T19_00_24_331Z_d9f625a92414: smoke e2e, exit 0
cmd_2026-05-27T19_00_33_667Z_982c1455e5e7: typecheck, exit 0
cmd_2026-05-27T19_01_08_745Z_b79b85db39e0: build:studio, exit 0
cmd_2026-05-27T19_01_18_497Z_466c2f308b48: git diff --check, exit 0
visual_2026-05-27T19_01_39_622Z_5eb93f079ea5: AS30 tablet screenshot proof
visual_2026-05-27T19_01_45_259Z_4f42eaa307b2: AS30 phone screenshot proof
```

Canvas generated `.stax` status/proof files are dirty locally and intentionally not committed.

## Pattern Promotion Impact

Current report:

```txt
docs/RAX_PATTERN_PROMOTION_IMPACT_REPORT.md
reports/pattern_promotion/pattern-promotion-impact-2026-05-27T19-06-32-594Z.json
```

Current result:

```txt
locked replay: 10 cases, 0 critical misses, 8 improved, 2 unchanged-safe, 0 regressed
current operating window: 3 imported bundles, 0 critical misses
full handoff contracts: 2/3
proof artifacts requested: 3/3
cleanup prompts needed: 2/3
```

Imported bundles:

```txt
STAX: improved
ADMISSION-APP: unchanged_safe, full handoff contract missing
canvas-helper: improved
```

ADMISSION-APP latest sidecar protocol commit:

```txt
22acdc54747b16a9008e9ecc532806707323add9
```

ADMISSION-APP remains `Provisional` in sidecar impact because no live Codex report/heartbeat was present; this is expected observer evidence, not an acceptance failure.

Keep these claims separate:

```txt
Locked replay = proves STAX behavior changed on frozen cases.
Current operating window = proves STAX helps live repos today.
```

## Local Proof Already Collected

STAX local proof after `fc10f3d`:

```txt
npm run typecheck: pass
npm test -- tests/proofSurfaceMatcher.test.ts tests/proofSurfaceMatcherAdversarial.test.ts: pass, 23 tests
npm run stax:collect -- --repo /Users/deanguedo/Documents/GitHub/STAX -- npm run typecheck: pass
npm run stax:gate -- --repo /Users/deanguedo/Documents/GitHub/STAX: Accept / Audit-grade
```

GitHub Actions:

```txt
staxcore-strict on fc10f3d: success
```

## Current Local Dirt

Expected generated proof files may be dirty:

```txt
.stax/status.json
.stax/proof_strength.json
.stax/next-codex-prompt.md
.stax/reports/latest-proof-report.md
.stax/reports/latest-confidence-report.md
```

There is also an unrelated untracked duplicate handoff:

```txt
docs/ACTIVE_HANDOFF 2.md
```

It has not been touched. Do not delete it unless Dean explicitly asks.

## Next Milestone

The next milestone remains attached-repo/current operating-window proof volume.

Acceptance target:

```txt
10 real tasks
3 repos minimum
0 critical misses
7/10 full handoff contract present
7/10 correct proof artifact requested
cleanup prompts tracked
```

Current operating-window status:

```txt
3 imported bundles
0 critical misses
2/3 full handoff contracts
3/3 proof artifact requests
```

Next best actions:

1. Run another current repo through the sidecar observer/export/import loop, preferably `brightspacequizexporter` if current on this workstation.
2. If no current attached repo is ready, add more local adversarial fixture coverage for repeated matcher/claim-extraction misses.
3. Keep updating `docs/RAX_PATTERN_PROMOTION_IMPACT_REPORT.md` only through `npm run pattern:impact`.

For each current attached repo, run:

```bash
npm run stax:sidecar-upgrade -- --repo <repo> --discover-surfaces
npm run stax:gate -- --repo <repo>
npm run stax:next-prompt -- --repo <repo>
npm run stax:export-impact-evidence -- --repo <repo> --out <repo-impact.json>
```

Or use the guarded batch helper from the STAX repo. Dry-run first:

```bash
npm run stax:attached-impact-export -- \
  --dry-run \
  --repo /Users/deanguedo/Documents/GitHub/canvas-helper \
  --repo /Users/deanguedo/Documents/GitHub/ADMISSION-APP \
  --repo /Users/deanguedo/Documents/GitHub/brightspacequizexporter \
  --out-dir reports/pattern_promotion/attached_repo_exports
```

Then, only for current repo checkouts:

```bash
npm run stax:attached-impact-export -- \
  --confirm-current-repos \
  --repo /Users/deanguedo/Documents/GitHub/canvas-helper \
  --repo /Users/deanguedo/Documents/GitHub/ADMISSION-APP \
  --repo /Users/deanguedo/Documents/GitHub/brightspacequizexporter \
  --out-dir reports/pattern_promotion/attached_repo_exports
```

Bring exported bundles back to STAX and import them:

```bash
npm run pattern:impact -- --import <repo-impact.json>
```

For multiple bundles:

```bash
npm run pattern:impact \
  -- --import canvas-helper-impact.json \
  --import admission-app-impact.json \
  --import brightspacequizexporter-impact.json
```

## What Not To Do Next

Do not:

```txt
auto-promote anything
build adaptive sandbox loop yet
run deploy / publish / sync
hard-gate ordinary local editing
claim STAX proves code correctness
commit generated .stax status/proof artifacts
delete docs/ACTIVE_HANDOFF 2.md unless explicitly asked
```

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
- commit: 58407fe7e4e87a9e93b17e2683983d4e7b1f9a5a
- short: 58407fe
- commit message: Refresh ADMISSION impact evidence
- GitHub Actions strict run: success
- CI URL: https://github.com/deanguedo-arch/STAX/actions/runs/26533491119

Goal:
Continue the attached-repo operating-window phase. Canvas helper and ADMISSION-APP have already been exported/imported for this pass. Brightspacequizexporter is currently on a resume branch while `origin/main` points elsewhere, so do not treat it as current-main operating-window proof until the branch/head is intentionally resolved.

Before claiming completion in STAX, run:
- npm run typecheck
- targeted tests for changed behavior

If integrity-path or release-gate behavior changes, also run:
- npm run validate:hardened
- npm run validate:staxcore:strict:ci

Use STAX sidecar proof for repo changes:
- npm run stax:collect -- --repo /Users/deanguedo/Documents/GitHub/STAX -- <command>
- npm run stax:gate -- --repo /Users/deanguedo/Documents/GitHub/STAX

Keep the final answer short and evidence-backed.
```

## Stop Condition

This handoff refresh is complete when:

```txt
docs/ACTIVE_HANDOFF.md is committed and pushed
docs/CURRENT_STATUS.md reflects the 3-bundle operating-window status
origin/main equals local main
GitHub staxcore-strict remains success on the pushed commit
generated .stax proof files remain unstaged
```
