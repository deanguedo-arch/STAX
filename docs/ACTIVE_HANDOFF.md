# Active Handoff

Date: 2026-05-28

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

Latest local rollout commit:

```txt
HEAD
```

Commit message:

```txt
Avoid mutating visual proof recommendations
```

GitHub Actions proof:

```txt
staxcore-strict: completed / success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26544755416
```

This commit should be pushed to `origin/main` before moving workstations. Generated `.stax` proof/status files and the unrelated duplicate `docs/ACTIVE_HANDOFF 2.md` are dirty locally and should stay unstaged.

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
d1c51d7 Tolerate sidecar report mtime granularity
5002d75 Harden proof routing and refresh impact window
557c76c Refresh active handoff after CI repair
4d806df Serialize visual proof manifest writes
b1d734d Record Canvas impact evidence import
```

The latest work:

- Fixed a CI-only turn-compliance false reject where Linux filesystem timestamp granularity made a freshly written `.stax/codex-report.md` look older than `.stax/turn-contract.json`.
- Added regression coverage so normal report mtime granularity stays a weak capture-lag warning instead of becoming a reject.
- Verified the fix locally with `npm run validate:hardened` and with STAX-collected command evidence for the current auditable worktree.
- Pushed the fix and verified GitHub Actions `staxcore-strict` completed successfully on `d1c51d7`.
- Fixed the attached-repo impact batch runner so `stax:next-prompt` reuses the just-written gate output with `--no-gate` instead of rerunning a duplicate gate.
- Added `stax:gate --no-learning-event` for observer/export automation so attached-repo evidence export does not add extra sidecar learning events.
- Re-ran the attached-repo export batch for Canvas Helper, ADMISSION-APP, and Brightspacequizexporter from current `main` checkouts.
- Rebuilt the pattern-promotion impact report from 10 imported bundles at `2026-05-27T23:55:36.065Z`.
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
- Recollected Brightspace current-main proof after sidecar proof-surface propagation:
  - `npm run build`: exit 0
  - `npm run ingest:ci`: exit 0
  - Forensics 25 export command: exit 0
  - sidecar gate: `Accept / Audit-grade`
- Exported the refreshed Brightspace impact bundle and rebuilt the pattern-promotion impact report at `2026-05-28T00:10:30.362Z`.
- Found that Canvas Helper's discovered/approved visual proof surface was recommending `npm run smoke:pipeline`.
- Confirmed `npm run smoke:pipeline` is mutating in Canvas Helper: it changed `.runtime/memory-ledger.json` and generated a large `projects/resources/smoke-calm-module/` output tree.
- Patched STAX proof-surface discovery so visual proof prefers non-mutating e2e/screenshot proof and excludes mutating smoke pipeline commands from `visual_ready`.
- Added regression coverage in `tests/proofSurfacePack.test.ts` so `npm run test:e2e:smoke` remains eligible visual proof but `npm run smoke:pipeline` does not.
- Re-discovered and re-approved Canvas Helper proof surfaces. The approved `visual_ready` surface now recommends `npm run test:e2e:smoke`, not `npm run smoke:pipeline`.
- Recollected Canvas Helper proof against the current auditable worktree:
  - `npm run build:studio`: exit 0
  - `npm run typecheck`: exit 0
  - `npm run test:e2e:smoke`: exit 0
  - tablet screenshot visual proof: captured
  - phone screenshot visual proof: captured
  - sidecar gate: `Accept / Audit-grade`
- Exported the refreshed Canvas impact bundle and rebuilt the pattern-promotion impact report at `2026-05-28T00:19:32.977Z`.

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
cmd_2026-05-28T00_15_53_634Z_b79b85db39e0: build:studio, exit 0
cmd_2026-05-28T00_16_02_897Z_982c1455e5e7: typecheck, exit 0
cmd_2026-05-28T00_16_12_303Z_d9f625a92414: smoke e2e, exit 0
visual_2026-05-28T00_16_24_656Z_f6c36d0f5b5a: AS30 tablet screenshot proof
visual_2026-05-28T00_16_25_480Z_c0659fbe90ad: AS30 phone screenshot proof
```

Canvas generated `.stax` status/proof files are dirty locally and intentionally not committed. Canvas also has cleanup-needed output generated by the earlier `npm run smoke:pipeline` proof attempt:

```txt
.runtime/memory-ledger.json
projects/resources/smoke-calm-module/**
```

Do not silently delete this output unless Dean approves cleanup. The STAX-side fix prevents this recurrence by avoiding `smoke:pipeline` as default visual proof.

## Pattern Promotion Impact

Current report:

```txt
docs/RAX_PATTERN_PROMOTION_IMPACT_REPORT.md
reports/pattern_promotion/pattern-promotion-impact-2026-05-27T22-51-28-732Z.json
reports/pattern_promotion/pattern-promotion-impact-2026-05-27T23-55-36-065Z.json
reports/pattern_promotion/pattern-promotion-impact-2026-05-28T00-19-32-977Z.json
```

Current result:

```txt
locked replay: 10 cases, 0 critical misses, 8 improved, 2 unchanged-safe, 0 regressed
current operating window: 10 imported bundles, 0 critical misses
full handoff contracts: 10/10
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
canvas-helper: improved, current visual proof-surface refresh bundle
brightspacequizexporter: improved, current-main build / ingest / Forensics 25 export bundle
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
proof strength: Audit-grade
commit: b7896b7de44c11c2f8ae34956bc20ed76f435e8f
```

The refreshed Brightspace bundle is now current-main evidence. STAX still records older historical command evidence, but current build, ingest, and Forensics 25 export proof are verified for the current auditable worktree.

Keep these claims separate:

```txt
Locked replay = proves STAX behavior changed on frozen cases.
Current operating window = proves STAX helps live repos today.
```

## Local Proof Already Collected

STAX local proof for the current pushed rollout baseline:

```txt
npm test -- tests/sidecarTurnCompliance.test.ts: pass, 17 tests
npm run validate:hardened: pass, 211 test files / 1109 tests through test:ci-safe
npm run stax:collect -- --repo /Users/deanguedo/Documents/GitHub/STAX -- npm run validate:hardened: pass, evidence cmd_2026-05-27T23_22_26_943Z_eea6194c401c
npm test -- tests/attachedRepoImpactExport.test.ts: pass, 3 tests
npm run stax:attached-impact-export -- --dry-run --repo canvas-helper --repo ADMISSION-APP --repo brightspacequizexporter: pass
npm run stax:attached-impact-export -- --confirm-current-repos --repo canvas-helper --repo ADMISSION-APP --repo brightspacequizexporter: pass, exported 3 bundles
npm run pattern:impact -- --import <10 bundles>: pass, 10 imported bundles / 0 critical misses / 10 proof artifact requests
npm run typecheck: pass
npm test -- tests/sidecarWatchCollect.test.ts tests/projectControlProofStackIntegration.test.ts tests/sidecarClaimExtractionPrecision.test.ts tests/claimProofMapping.test.ts: pass, 64 tests
npm run stax:collect -- --repo /Users/deanguedo/Documents/GitHub/STAX -- npm test -- tests/sidecarWatchCollect.test.ts tests/projectControlProofStackIntegration.test.ts tests/sidecarClaimExtractionPrecision.test.ts tests/claimProofMapping.test.ts: pass
npm run stax:gate -- --repo /Users/deanguedo/Documents/GitHub/STAX: Accept / Audit-grade
npm test -- tests/proofSurfacePack.test.ts: pass, 15 tests
npm run typecheck: pass after the visual proof-surface patch
npm test: pass, 211 test files / 1110 tests
npm run smoke:stax: pass
npm run rax -- eval: pass, 16/16 evals
```

GitHub Actions:

```txt
staxcore-strict on d1c51d7: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26544755416
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

Durable rollout files already committed and pushed in `5002d75`:

```txt
reports/pattern_promotion/attached_repo_exports/ADMISSION-APP-impact-current-build.json
reports/pattern_promotion/attached_repo_exports/STAX-impact-current-fingerprint.json
reports/pattern_promotion/attached_repo_exports/studentbudgetwars-impact-syntax-env.json
reports/pattern_promotion/pattern-promotion-impact-2026-05-27T22-51-28-732Z.json
```

Older intermediate impact JSON files from that run were superseded and left out; keep using the final `pattern-promotion-impact-2026-05-27T22-51-28-732Z.json` unless a fresh `npm run pattern:impact` run replaces it.

Attached repo dirt created by observer work:

```txt
/Users/deanguedo/Documents/GitHub/ADMISSION-APP
- docs/index.html changed by `npm run build:pages`
- generated `.stax` status/proof files dirty

/Users/deanguedo/Documents/GitHub/canvas-helper
- approved sidecar proof surfaces updated to avoid mutating visual proof recommendations
- generated `.stax` status/proof files dirty
- `.runtime/memory-ledger.json` and `projects/resources/smoke-calm-module/**` changed/generated by the earlier `npm run smoke:pipeline` proof attempt
- Canvas sidecar is currently `Accept / Audit-grade`, but cleanup of smoke output still needs an explicit keep/remove decision

/Users/deanguedo/Documents/GitHub/studentbudgetwars
- .gitignore changed by STAX attach
- AGENTS.md created by STAX attach
- .stax/ sidecar created
```

## Next Milestone

The next milestone is continuing attached-repo operating-window proof from the green STAX baseline, then deciding how to handle attached-repo local dirt.

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
10/10 full handoff contracts
10/10 proof artifact requests
9/10 cleanup prompts needed
```

Immediate next action after committing/pushing this STAX patch:

```txt
Decide whether to clean the Canvas Helper smoke-generated output. If cleaned, recollect Canvas build/typecheck/test:e2e:smoke and visual proof against the cleaned worktree, then export/import a final Canvas impact bundle.
```

Next best actions:

1. Use `d1c51d7` as the current green STAX baseline.
2. Treat the new cleanup-needed observer output as useful learning: sidecar upgrades/discovery stale prior command evidence and require fresh `stax:collect`.
3. For Canvas Helper, recollect the approved visual/build/test proof commands only when you are ready to spend the time, then rerun `stax:gate`.
4. For Brightspacequizexporter, recollect `npm run build` and `npm run ingest:ci` through `stax:collect` before claiming current Accept again.
5. In ADMISSION-APP, decide whether to keep or revert the generated `docs/index.html` diff before committing there.
6. In studentbudgetwars, decide whether to keep and commit the new STAX sidecar attach files.
7. Keep updating `docs/RAX_PATTERN_PROMOTION_IMPACT_REPORT.md` only through `npm run pattern:impact`.

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
- commit: d1c51d753489a03f8d5e5cb92e5ae9b203c0740e
- short: d1c51d7
- commit message: Tolerate sidecar report mtime granularity
- GitHub Actions strict run: success
- CI URL: https://github.com/deanguedo-arch/STAX/actions/runs/26544755416

Goal:
Continue the attached-repo operating-window phase from green STAX baseline `d1c51d7`. STAX, ADMISSION-APP, Canvas Helper, Brightspacequizexporter, and studentbudgetwars are imported into the current impact report. The latest attached-repo batch completed and produced cleanup-needed bundles for Canvas Helper, ADMISSION-APP, and Brightspace after sidecar proof-surface discovery changed sidecar state. That is expected observer learning: refresh command evidence after sidecar upgrades before claiming current Accept. The CI-only turn-compliance mtime false reject is fixed and green in GitHub Actions.

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
docs/RAX_PATTERN_PROMOTION_IMPACT_REPORT.md reflects the 10-bundle operating-window status
origin/main equals local main
GitHub staxcore-strict remains success on the pushed commit
generated .stax proof files remain unstaged
```
