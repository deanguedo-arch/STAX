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

Latest pushed rollout baseline:

```txt
557c76c95b238cd9c4c20c5fc5ed3d0afa817335
```

Commit message:

```txt
Refresh active handoff after CI repair
```

GitHub Actions proof:

```txt
staxcore-strict: completed / success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26538928648
```

Local `main` and `origin/main` were aligned before the current uncommitted rollout patch.

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

- Fixed claim extraction so `What is weak/provisional` caution language no longer becomes hard release/data/visual claims.
- Fixed project-control command relevance so protocol-compliance wording and cross-repo command-log metadata do not route current test proof into the wrong proof lane.
- Added regression coverage for both false-reject classes.
- Fixed sidecar worktree fingerprinting so nested dependency trees such as `mobile/ios-wrapper/node_modules/**` are excluded, not only top-level `node_modules/**`.
- Added regression coverage for nested dependency-tree exclusion using the ADMISSION-shaped path.
- Refreshed the ADMISSION-APP local page-build observer bundle. It now gates `Accept / Audit-grade` for the narrowed local build-proof claim, but `docs/index.html` remains changed in ADMISSION and needs a separate keep/revert decision.
- Attached STAX to `studentbudgetwars` and exported a syntax-only observer bundle. That repo lacks a working pytest/pydantic environment on this workstation, so the bundle is cleanup-needed evidence, not a tests-passed claim.
- Rebuilt the pattern-promotion impact report to the 10-bundle operating-window target.
- Excluded generated runtime/export artifacts from sidecar worktree fingerprints while keeping real source/test/config changes auditable.
- Added regression coverage for generated export and Python bytecode fingerprint behavior.
- Serialized visual-proof manifest writes so concurrent visual proof collection cannot corrupt `.stax/visual-proofs/manifest.json`.
- Added regression coverage for concurrent visual proof collection.
- Refreshed `canvas-helper` current-head proof on this workstation.
- Exported the fresh Canvas operating-window impact bundle.
- Rebuilt the pattern-promotion impact report with STAX, ADMISSION-APP, and Canvas imports.
- Updated the ADMISSION-APP sidecar visual-proof protocol wording and pushed it to ADMISSION-APP `main`.
- Refreshed the ADMISSION-APP impact bundle against clean head `22acdc54747b16a9008e9ecc532806707323add9`.
- Recollected Brightspace current-main command proof after sidecar proof-surface propagation.
- Added a STAX regression so older wrong-branch command evidence is ignored as historical only after newer verified same-lane proof exists.
- Fixed the regression test for CI portability by returning to the temp repo's actual default branch instead of assuming `main`.
- Exported the refreshed Brightspace impact bundle after Brightspace reached sidecar Accept.

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
reports/pattern_promotion/pattern-promotion-impact-2026-05-27T22-51-28-732Z.json
```

Current result:

```txt
locked replay: 10 cases, 0 critical misses, 8 improved, 2 unchanged-safe, 0 regressed
current operating window: 10 imported bundles, 0 critical misses
full handoff contracts: 9/10
proof artifacts requested: 10/10
cleanup prompts needed: 9/10
```

Imported bundles:

```txt
STAX: improved, prior proof-surface discovery task
STAX: improved, current fingerprint/claim-routing task
ADMISSION-APP: unchanged_safe, earlier observer bundle with full handoff contract missing
ADMISSION-APP: improved, current local page-build observer bundle
canvas-helper: improved, 2026-05-22 live repo bundle
canvas-helper: improved, expanded-sidebar fit bundle
canvas-helper: improved, AS30 tablet/mobile unit-card bundle
canvas-helper: improved, current-worktree observer refresh bundle
brightspacequizexporter: improved, Forensics 25 export bundle
studentbudgetwars: improved, syntax-only cleanup-needed observer bundle
```

ADMISSION-APP latest sidecar protocol commit:

```txt
22acdc54747b16a9008e9ecc532806707323add9
```

ADMISSION-APP current local page-build observer gate:

```txt
verdict: Accept
proof strength: Audit-grade
commit: 22acdc54747b16a9008e9ecc532806707323add9
note: `docs/index.html` changed when `npm run build:pages` ran; decide keep/revert in ADMISSION before committing there.
```

Brightspacequizexporter is now included as observer evidence on `main` at:

```txt
b7896b7de44c11c2f8ae34956bc20ed76f435e8f
```

Brightspace sidecar status after the follow-up patch:

```txt
verdict: Accept
proof strength: Strong
commit: b7896b7de44c11c2f8ae34956bc20ed76f435e8f
```

The refreshed Brightspace bundle is now clean current-main evidence. STAX still records the older wrong-branch export command as historical, but it no longer poisons the verdict once newer verified same-lane proof exists.

Keep these claims separate:

```txt
Locked replay = proves STAX behavior changed on frozen cases.
Current operating window = proves STAX helps live repos today.
```

## Local Proof Already Collected

STAX local proof for the current uncommitted rollout patch:

```txt
npm run typecheck: pass
npm test -- tests/sidecarWatchCollect.test.ts tests/projectControlProofStackIntegration.test.ts tests/sidecarClaimExtractionPrecision.test.ts tests/claimProofMapping.test.ts: pass, 64 tests
npm run stax:collect -- --repo /Users/deanguedo/Documents/GitHub/STAX -- npm test -- tests/sidecarWatchCollect.test.ts tests/projectControlProofStackIntegration.test.ts tests/sidecarClaimExtractionPrecision.test.ts tests/claimProofMapping.test.ts: pass
npm run stax:gate -- --repo /Users/deanguedo/Documents/GitHub/STAX: Accept / Audit-grade
```

GitHub Actions:

```txt
staxcore-strict on 557c76c: success
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

New durable files from the current uncommitted rollout patch:

```txt
reports/pattern_promotion/attached_repo_exports/ADMISSION-APP-impact-current-build.json
reports/pattern_promotion/attached_repo_exports/STAX-impact-current-fingerprint.json
reports/pattern_promotion/attached_repo_exports/studentbudgetwars-impact-syntax-env.json
reports/pattern_promotion/pattern-promotion-impact-2026-05-27T22-51-28-732Z.json
```

Older intermediate impact JSON files from this same run were superseded and left out; commit only the final `pattern-promotion-impact-2026-05-27T22-51-28-732Z.json`.

Attached repo dirt created by observer work:

```txt
/Users/deanguedo/Documents/GitHub/ADMISSION-APP
- docs/index.html changed by `npm run build:pages`
- generated `.stax` status/proof files dirty

/Users/deanguedo/Documents/GitHub/studentbudgetwars
- .gitignore changed by STAX attach
- AGENTS.md created by STAX attach
- .stax/ sidecar created
```

## Next Milestone

The next milestone is packaging and pushing the current STAX rollout patch, then deciding how to handle attached-repo local dirt.

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
10 imported bundles
0 critical misses
9/10 full handoff contracts
10/10 proof artifact requests
```

Next best actions:

1. Stage and commit the STAX source/test/report/export changes, leaving generated `.stax` runtime files and unrelated `docs/ACTIVE_HANDOFF 2.md` unstaged unless explicitly requested.
2. Push STAX `main` and verify GitHub Actions.
3. In ADMISSION-APP, decide whether to keep or revert the generated `docs/index.html` diff.
4. In studentbudgetwars, decide whether to keep and commit the new STAX sidecar attach files.
5. Keep updating `docs/RAX_PATTERN_PROMOTION_IMPACT_REPORT.md` only through `npm run pattern:impact`.

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

Current published baseline before this handoff update:
- commit: d1f69dad7e81c1f4f7775853365ff2a661311bdb
- short: d1f69da
- commit message: Fix sidecar regression branch portability
- GitHub Actions strict run: success
- CI URL: https://github.com/deanguedo-arch/STAX/actions/runs/26538318537

Goal:
Continue the attached-repo operating-window phase. STAX, ADMISSION-APP, Canvas Helper, and Brightspacequizexporter are imported into the current impact report. Canvas Helper has a fresh current-head sidecar Accept. Brightspace reached sidecar Accept after current-main proof recollection and a STAX patch that ignores older same-lane wrong-branch evidence only when newer verified proof exists.

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
docs/RAX_PATTERN_PROMOTION_IMPACT_REPORT.md reflects the 4-bundle operating-window status
origin/main equals local main
GitHub staxcore-strict remains success on the pushed commit
generated .stax proof files remain unstaged
```
