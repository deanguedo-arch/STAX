# Active Handoff

Date: 2026-05-28

## Latest Restart Note

Latest verified STAX commit before this handoff refresh:

```txt
9945855
```

Commit message:

```txt
Refresh handoff after status staleness fix
```

GitHub Actions proof:

```txt
staxcore-strict: completed / success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26589788843
```

This supersedes the older `92855f5` historical baseline named below. If this file is part of a newer handoff-only commit, verify that newer commit's `staxcore-strict` run before treating it as the restart baseline.

Latest completed sidecar-learning, handoff, and observed-regression cleanup sequence:

```txt
738f23f Promote visual proof aggregate
a2591fe Promote proof boundary aggregate
0343cf4 Promote policy safety aggregate
461ee2b Refresh STAX rollout handoff
66d5ced Close reviewed sidecar candidates
03561cf Refresh handoff after queue closure
1a87f23 Refresh active handoff baseline guidance
abe74dd Add attached repo impact handoff
565b795 Harden URL path grounding regression
7f60c86 Refresh status after URL grounding hardening
42c8552 Harden Canvas course image proof surface
9d07174 Refresh handoff after Canvas proof surface hardening
36a6af7 Reduce sidecar ACK capture lag noise
cb7882d Refresh handoff after ACK noise fix
54292bf Clarify stale sidecar status reads
9945855 Refresh handoff after status staleness fix
```

The STAX sidecar learning dashboard now reports:

```txt
Pending candidates: 0
Promoted candidates: 96
Rejected/deferred candidates: 9
Promotable aggregate groups: 0
Reviewed aggregate groups: 0
Top aggregate recommendation: none
Recommended next action: No pending sidecar learning action.
```

Current operating-window proof remains:

```txt
14 imported bundles
0 critical misses
14/14 full handoff contracts present
14/14 proof artifacts requested
```

Next narrow STAX-only actions, if continuing without touching attached repos:

```txt
1. Keep docs/current-status surfaces aligned with the latest verified commit after each pushed STAX closure.
2. Add additional adversarial proof-surface/claim-extraction cases only when they correspond to observed false positives or false negatives.
3. Use `docs/handoffs/ATTACHED_REPO_IMPACT_EVIDENCE_HANDOFF.md` for the workstation that owns the live repos.
4. Continue real observer runs only when the target repo is not being edited in another terminal.
```

Do not run Canvas Helper sidecar upgrade/gate while the user is actively editing Canvas Helper in another terminal unless explicitly asked.

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

Latest verified rollout commit before this handoff refresh:

```txt
9945855
```

Commit message:

```txt
Refresh handoff after status staleness fix
```

GitHub Actions proof:

```txt
staxcore-strict: completed / success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26589788843
```

This verified rollout commit is pushed to `origin/main`. Note: `docs/ACTIVE_HANDOFF 2.md` is now present on `main` as a tracked historical duplicate; do not use it as the active restart source unless the user explicitly asks to reconcile or remove it. Use `docs/ACTIVE_HANDOFF.md` and the top Latest Restart Note.

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

The latest verified STAX baseline named at the top of this file is current and pushed. The raw sidecar-learning queue closure, handoff/export handoff refresh, and hosted URL/prose slash grounding regression landed after the older Brightspace ingest stabilization baseline.

Recent pushed commits include:

```txt
9945855 Refresh handoff after status staleness fix
54292bf Clarify stale sidecar status reads
cb7882d Refresh handoff after ACK noise fix
36a6af7 Reduce sidecar ACK capture lag noise
9d07174 Refresh handoff after Canvas proof surface hardening
42c8552 Harden Canvas course image proof surface
7f60c86 Refresh status after URL grounding hardening
565b795 Harden URL path grounding regression
abe74dd Add attached repo impact handoff
1a87f23 Refresh active handoff baseline guidance
03561cf Refresh handoff after queue closure
66d5ced Close reviewed sidecar candidates
461ee2b Refresh STAX rollout handoff
0343cf4 Promote policy safety aggregate
a2591fe Promote proof boundary aggregate
738f23f Promote visual proof aggregate
92855f5 Record Brightspace ingest stabilization impact
6418a4d Refresh handoff after ADMISSION CI
6850708 Import ADMISSION proof and stabilize validation
618589a Import studentbudgetwars sidecar proof
c273432 commit
c2c80b9 Refresh handoff after Canvas proof CI
9ab09ae Record Canvas current proof refresh
b77067d Speed up ignored-file fingerprint scan
4542860 Speed up stale command evidence checks
f9abe14 Refresh handoff after Python proof lane CI
8b57c08 Normalize Python command proof lanes
d1c51d7 Tolerate sidecar report mtime granularity
5002d75 Harden proof routing and refresh impact window
557c76c Refresh active handoff after CI repair
4d806df Serialize visual proof manifest writes
b1d734d Record Canvas impact evidence import
```

The latest work:

- Refreshed `docs/releases/STAX_RC_CURRENT/command_proof.md` against current pushed `main` at `994585538b29d96157e5fa67aba693114513c766`.
- Re-ran the Phase 0 baseline commands on the current pushed checkout:
  - `npm ci`, exit 0
  - `npm run typecheck`, exit 0
  - `npm test`, exit 0, 212 files and 1125 tests
  - `npm run smoke:stax`, exit 0, run `run-2026-05-28T17-15-46-614Z-ko5gm1`
  - `npm run rax -- eval`, exit 0, 16/16 evals
- Refreshed the rollout phase gate artifacts; `npm run stax:rollout:gate` exited 0 and reports phases 0 through 6 passed their deterministic gates.
- Clarified `stax:status` output so it explicitly says whether it is reading last-known stored status or generating a fresh audit because no status exists.
- Added status freshness output for stored commit/branch mismatch and dirty-worktree possible staleness, with a direct prompt to run `stax gate --repo <path>` for current proof.
- Added regression coverage in `tests/staxStatus.test.ts` for last-known status wording, stale commit detection, and dirty-worktree possible staleness.
- Verified the status-staleness patch with STAX-collected command evidence:
  - `cmd_2026-05-28T16_55_40_491Z_7262ce780b06`: `npm test -- tests/staxStatus.test.ts tests/cliProofGate.test.ts`, exit 0
  - `cmd_2026-05-28T16_55_48_458Z_982c1455e5e7`: `npm run typecheck`, exit 0
  - `cmd_2026-05-28T16_55_58_638Z_328e123c6385`: `npm test`, exit 0
  - `cmd_2026-05-28T16_56_28_494Z_092594e366f2`: `npm run smoke:stax`, exit 0
  - `cmd_2026-05-28T16_56_34_649Z_31b060f341fa`: `npm run rax -- eval`, exit 0
  - STAX sidecar gate: `Accept / Audit-grade`
- Pushed `54292bf Clarify stale sidecar status reads` and verified GitHub Actions `staxcore-strict` completed successfully.
- Reduced normal-mode sidecar ACK timing noise so a correct current ACK in the Codex report is accepted when current-turn capture lags.
- Kept strict-mode protocol behavior hard: strict mode still rejects when current-turn capture lacks the current ACK.
- Added/updated regression coverage in `tests/sidecarTurnCompliance.test.ts` for normal-mode capture-lag acceptance, mtime granularity, gate-level protocol `ok`, and strict-mode rejection.
- Verified the ACK timing patch with STAX-collected command evidence:
  - `cmd_2026-05-28T16_37_53_692Z_9462a3daffbf`: `npm test -- tests/sidecarTurnCompliance.test.ts`, exit 0
  - `cmd_2026-05-28T16_38_00_121Z_982c1455e5e7`: `npm run typecheck`, exit 0
  - `cmd_2026-05-28T16_38_07_781Z_328e123c6385`: `npm test`, exit 0
  - `cmd_2026-05-28T16_38_36_475Z_092594e366f2`: `npm run smoke:stax`, exit 0
  - `cmd_2026-05-28T16_38_41_456Z_31b060f341fa`: `npm run rax -- eval`, exit 0
  - STAX sidecar gate: `Accept / Audit-grade`
- Pushed `36a6af7 Reduce sidecar ACK capture lag noise` and verified GitHub Actions `staxcore-strict` completed successfully.
- Hardened the Canvas Helper static proof surface so course-deploy claims involving external images, remote asset URLs, or placeholders require approved image-source proof and placeholder removal/localization proof.
- Added ProofSurfaceMatcher routing for external/remote image wording, Wikimedia URLs, Google user-content/API/storage URLs, and placeholder-image language to the Canvas `course_deploy_ready` surface.
- Added regression coverage so Canvas external image claims and remote image link claims route to course-deploy proof requirements instead of being treated as sufficient visual acceptance proof.
- Verified the Canvas course image proof-surface hardening with STAX-collected command evidence:
  - `cmd_2026-05-28T16_17_25_907Z_d2fd4393b631`: focused proof-surface matcher and pack tests, exit 0
  - `cmd_2026-05-28T16_17_33_825Z_982c1455e5e7`: `npm run typecheck`, exit 0
  - `cmd_2026-05-28T16_17_43_075Z_328e123c6385`: `npm test`, exit 0, 211 files and 1122 tests
  - `cmd_2026-05-28T16_18_19_110Z_092594e366f2`: `npm run smoke:stax`, exit 0
  - `cmd_2026-05-28T16_18_27_714Z_31b060f341fa`: `npm run rax -- eval`, exit 0, 16/16 evals
  - STAX sidecar gate: `Accept / Audit-grade`
- Pushed `42c8552 Harden Canvas course image proof surface` and verified GitHub Actions `staxcore-strict` completed successfully.
- Repaired and pushed Brightspacequizexporter `dc3635f Stabilize ingest promotion benchmarks`.
- The Brightspace pushed change records manual gold fixture evaluations as isolated Vitest invocations; the AP35 OCR-heavy fixture is covered by the pushed pre-push evidence.
- Brightspace pre-push `ingest:ci` passed on `dc3635f`, including 232 focused ingest tests and 22 isolated manual gold fixture evaluations.
- Recollected Brightspace current-commit STAX command proof after the push:
  - `cmd_2026-05-28T12_12_02_015Z_16c0e4305ac2`: `npm run build`, exit 0
  - `cmd_2026-05-28T12_12_13_099Z_d71165c624a9`: `npm run ingest:ci`, exit 0
  - `cmd_2026-05-28T12_13_13_756Z_68d10f27e54c`: local Forensics 25 MS Forms export, exit 0
  - Brightspace sidecar gate: `Accept / Audit-grade` on `dc3635ff79b346035f5e179a0c8a6a06fbe74359`
- Exported the Brightspace impact bundle: `reports/pattern_promotion/attached_repo_exports/brightspacequizexporter-impact-ingest-stabilized-2026-05-28.json`.
- Rebuilt the pattern-promotion impact report at `2026-05-28T12:15:17.138Z`: locked replay remains 10 cases / 0 critical misses; current operating window is now 14 imported bundles / 0 critical misses / 14 of 14 full handoff contracts / 14 of 14 proof artifacts requested.
- Imported the refreshed ADMISSION-APP non-mutating page-build observer evidence into the STAX pattern-promotion impact report.
- Kept the ADMISSION proof boundary narrow: local page build to `/tmp/stax-admission-pages/index.html` only; no live sync, deploy, publish, dataset validation, or visual readiness claim.
- Fixed a command-evidence classifier false positive where passing `npm run rax -- eval` output was held for human review just because generated eval-case prose mentioned "skipped" tests.
- Added regression coverage so passing eval JSON with prose such as "keep new tests as skipped only if..." remains strong local proof when the eval summary itself passes.
- Capped Vitest workers at 4 so `npm test` does not fail under full-suite fork-worker startup timeouts on this workstation.
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
- Fixed Canvas Helper's `npm run smoke:pipeline` so default smoke validation uses a scratch `smoke-local-pipeline-*` project, defaults intelligence policy to `off` unless explicit CLI flags are supplied, and removes scratch project/resource output after the run.
- Cleaned the old generated `projects/resources/smoke-calm-module/**` output from the earlier proof attempt while preserving tracked resource seed files.
- Revalidated Canvas Helper:
  - `npm run typecheck`: exit 0
  - `npm run build:studio`: exit 0
  - `npm run smoke:pipeline`: exit 0
  - `git diff --check`: exit 0
  - no `projects/smoke-local-pipeline-*` or `projects/resources/smoke-local-pipeline-*` directories remained after smoke.
- Recollected Canvas Helper STAX evidence against the current auditable worktree:
  - `cmd_2026-05-28T00_42_31_780Z_982c1455e5e7`: typecheck, exit 0
  - `cmd_2026-05-28T00_42_40_232Z_b79b85db39e0`: build:studio, exit 0
  - `cmd_2026-05-28T00_42_50_638Z_fc5201af80c5`: smoke:pipeline, exit 0
  - `cmd_2026-05-28T00_43_03_493Z_466c2f308b48`: git diff --check, exit 0
  - `visual_2026-05-28T00_49_56_999Z_1cc4dd9a6b10`: AS30 tablet image proof re-registered for current worktree
  - `visual_2026-05-28T00_50_10_643Z_2110aa94b93f`: AS30 phone image proof re-registered for current worktree
  - sidecar gate: `Accept / Audit-grade`
- Committed and pushed Canvas Helper `16749182 Keep smoke pipeline proof runs isolated`.
- Exported the post-push Canvas impact bundle and rebuilt the pattern-promotion impact report at `2026-05-28T00:54:59.876Z`.
- Made STAX proof-surface prompt hints actionable for visual proof by appending the exact `npm run stax:collect-visual -- --repo <repo> --path <screenshot.png>` command and required checklist shape whenever a matched surface requires rendered screenshot/checklist proof.
- Added regression assertions so candidate and approved visual proof-surface hints include the visual collection command, and course-deploy hints include visual collection without suggesting unsafe live deploy commands.
- Verified the visual-hint patch with STAX-collected proof:
  - `cmd_2026-05-28T01_17_54_297Z_982c1455e5e7`: `npm run typecheck`, exit 0
  - `cmd_2026-05-28T01_18_59_389Z_72dca3fc79fa`: focused proof-surface/matcher/sidecar tests, exit 0
  - `cmd_2026-05-28T01_20_06_559Z_092594e366f2`: `npm run smoke:stax`, exit 0
  - STAX sidecar gate: `Accept / Audit-grade`
- Committed and pushed STAX `7a27a6f Make visual proof hints actionable`.
- Verified GitHub Actions `staxcore-strict` completed successfully on `7a27a6f`.
- Attached STAX to `studentbudgetwars`, repaired its ignored local `.venv`, and collected useful observer proof:
  - narrowed non-window pytest proof: 377 passed, 1 deselected
  - data validation proof: passed
  - full suite still not claimed because local Tcl/Tk/windowing failures remain
- The studentbudgetwars observer run exposed a STAX proof-lane issue: a later passing Python script rerun through a different interpreter wrapper was not clearly superseding older failed same-script evidence.
- Fixed STAX command proof-lane normalization so equivalent Python script invocations share the same proof lane:
  - `python3 tools/validate_data.py`
  - `/usr/bin/env PYTHONPATH=src python3 tools/validate_data.py`
  - `/repo/.venv/bin/python tools/validate_data.py`
- Kept narrowed `pytest` evidence distinct from full-suite `pytest` evidence, so scoped proof cannot certify the whole suite.
- Verified the Python proof-lane patch with:
  - `npm run typecheck`: exit 0
  - `npm test -- tests/sidecarWatchCollect.test.ts tests/proofSurfacePack.test.ts`: exit 0, 43 tests
  - `npm run stax:gate -- --repo /Users/deanguedo/Documents/GitHub/STAX`: `Accept`
- Committed and pushed STAX `8b57c08 Normalize Python command proof lanes`.
- Verified GitHub Actions `staxcore-strict` completed successfully on `8b57c08`.
- Refreshed this handoff once after Python proof-lane CI in `f9abe14 Refresh handoff after Python proof lane CI`.
- Found that a fresh Canvas Helper sidecar gate was taking too long because old command evidence forced repeated expensive sidecar-only commit-advance checks.
- Patched STAX command evidence verification so stale wrong-worktree evidence short-circuits as stale/wrong-commit proof, sidecar-only commit checks are cached per gate run, and the committed-tree check uses `git diff-tree --no-commit-id --name-only -r`.
- Verified the Canvas gate performance/provenance fix with:
  - `npm run typecheck`: exit 0
  - `npm test -- tests/sidecarWatchCollect.test.ts tests/commandEvidenceLedger.test.ts`: exit 0, 30 tests
  - direct timed Canvas gate: exit 1 as expected, completed in 4.27 seconds, reported stale-proof `Reject` with `wrong_commit`
  - STAX-collected Canvas verifier: exit 0, evidence `cmd_2026-05-28T03_10_15_896Z_c6532a3cbd8b`, Canvas gate elapsed 4547ms
  - STAX sidecar gate for the patch: `Accept / Audit-grade`
- Committed and pushed STAX `4542860 Speed up stale command evidence checks`.
- Verified GitHub Actions `staxcore-strict` completed successfully on `4542860`.
- While refreshing this handoff, `stax:collect` exposed a second performance issue: ignored-file worktree fingerprinting asked Git to enumerate every ignored file before filtering dependency/generated trees.
- Patched `src/sidecar/WorktreeFingerprint.ts` so ignored relevant files are queried through bounded proof-relevant pathspecs instead of a full ignored-file scan.
- Verified the fingerprint patch with:
  - direct timing probe before patch: about 26851ms for the current STAX worktree
  - direct timing probe after patch: about 101ms for the current STAX worktree
  - `npm test -- tests/sidecarWatchCollect.test.ts -t "tracks ignored relevant source files"`: exit 0
  - `npm run stax:collect -- --repo /Users/deanguedo/Documents/GitHub/STAX -- npm run typecheck`: exit 0
  - `npm run stax:collect -- --repo /Users/deanguedo/Documents/GitHub/STAX -- npm test -- tests/sidecarWatchCollect.test.ts tests/commandEvidenceLedger.test.ts`: exit 0
  - STAX sidecar gate after updating the current acknowledgement: `Accept`
- Committed and pushed STAX `b77067d Speed up ignored-file fingerprint scan`.
- Verified GitHub Actions `staxcore-strict` completed successfully on `b77067d`.
- Refreshed Canvas Helper current-head command proof after the STAX gate-speed fixes:
  - Canvas sidecar gate: `Accept / Audit-grade`
  - Canvas commit: `167491821e462fdd5baf649be5b5153ce5bbcf03`
  - current-head command evidence: typecheck, build:studio, smoke:pipeline, and git diff check all exited 0 through STAX command collection
  - exported bundle: `reports/pattern_promotion/attached_repo_exports/canvas-helper-impact-2026-05-28-current-proof-refresh.json`
  - regenerated impact report: `reports/pattern_promotion/pattern-promotion-impact-2026-05-28T03-44-56-356Z.json`
  - current operating window was 10 imported bundles at that point, before later ADMISSION/Brightspace imports moved it to 14 imported bundles
- Committed and pushed STAX `9ab09ae Record Canvas current proof refresh`.
- Verified GitHub Actions `staxcore-strict` completed successfully on `9ab09ae`.
- Refreshed handoff/status artifacts through `c273432`; GitHub Actions `staxcore-strict` completed successfully on `c273432`.
- Later verified baselines superseded `c273432`; use the top Latest Restart Note as the current STAX baseline.

## Current Canvas Helper State

The local `canvas-helper` checkout is now current on this workstation.

Canvas latest pushed commit:

```txt
167491821e462fdd5baf649be5b5153ce5bbcf03
```

Canvas GitHub Pages proof:

```txt
pages build and deployment: completed / success
run: https://github.com/deanguedo-arch/canvas-helper/actions/runs/26532152321
```

Canvas STAX sidecar gate before the STAX stale-evidence speed fix:

```txt
verdict: Accept
proof strength: Audit-grade
commit: 167491821e462fdd5baf649be5b5153ce5bbcf03
```

Current fresh Canvas gate status after proof refresh:

```txt
verdict: Accept
proof strength: Audit-grade
commit: 167491821e462fdd5baf649be5b5153ce5bbcf03
note: STAX `4542860` and later first proved the old stale evidence was rejected quickly; fresh command proof was then recollected at current Canvas head.
```

Fresh Canvas evidence collected after `16749182` was pushed:

```txt
cmd_2026-05-28T03_41_07_369Z_982c1455e5e7: typecheck, exit 0
cmd_2026-05-28T03_41_23_177Z_b79b85db39e0: build:studio, exit 0
cmd_2026-05-28T03_41_35_482Z_fc5201af80c5: smoke:pipeline, exit 0
cmd_2026-05-28T03_41_47_741Z_466c2f308b48: git diff --check, exit 0
visual_2026-05-27T19_01_39_622Z_5eb93f079ea5: current-worktree rendered screenshot
visual_2026-05-27T19_01_45_259Z_4f42eaa307b2: current-worktree rendered screenshot
visual_2026-05-27T19_42_30_287Z_4baa04428334: current-worktree rendered screenshot
```

Canvas generated `.stax` status/proof files are dirty locally and intentionally not committed. The earlier `npm run smoke:pipeline` generated resource output has been cleaned.

```txt
dirty: .stax/proof_strength.json, .stax/status.json, .stax/reports/latest-*.md
cleaned: .runtime/memory-ledger.json and projects/resources/smoke-calm-module/** generated output
```

The earlier STAX-side visual proof fix prevents recurrence by avoiding `smoke:pipeline` as default visual proof, and the Canvas-side fix makes default smoke runs scratch-scoped and cleanup-safe. The later STAX stale-evidence speed fix prevents Canvas fresh gate from hanging on historical command evidence, and the current Canvas proof refresh confirms the pushed Canvas head is back to `Accept / Audit-grade`.

## Pattern Promotion Impact

Current report:

```txt
docs/RAX_PATTERN_PROMOTION_IMPACT_REPORT.md
reports/pattern_promotion/pattern-promotion-impact-2026-05-27T22-51-28-732Z.json
reports/pattern_promotion/pattern-promotion-impact-2026-05-27T23-55-36-065Z.json
reports/pattern_promotion/pattern-promotion-impact-2026-05-28T00-19-32-977Z.json
reports/pattern_promotion/pattern-promotion-impact-2026-05-28T00-54-59-876Z.json
reports/pattern_promotion/pattern-promotion-impact-2026-05-28T03-44-56-356Z.json
reports/pattern_promotion/pattern-promotion-impact-2026-05-28T04-45-19-743Z.json
reports/pattern_promotion/pattern-promotion-impact-2026-05-28T12-15-17-138Z.json
```

Current result:

```txt
locked replay: 10 cases, 0 critical misses, 8 improved, 2 unchanged-safe, 0 regressed
current operating window: 14 imported bundles, 0 critical misses
full handoff contracts: 14/14
proof artifacts requested: 14/14
cleanup prompts needed: 13/14
```

Imported bundles:

```txt
STAX: improved, prior proof-surface discovery task
STAX: improved, current fingerprint/claim-routing task
ADMISSION-APP: unchanged_safe, earlier observer bundle with full handoff contract missing
ADMISSION-APP: improved, current non-mutating page-build observer bundle at `8b0aa91`
canvas-helper: improved, 2026-05-22 live repo bundle
canvas-helper: improved, expanded-sidebar fit bundle
canvas-helper: improved, AS30 tablet/mobile unit-card bundle
canvas-helper: improved, post-push smoke-clean bundle
canvas-helper: improved, current-head proof refresh bundle
brightspacequizexporter: improved, current-main build / ingest / Forensics 25 export bundle at `b7896b7`
brightspacequizexporter: improved, isolated ingest promotion benchmark evidence and refreshed export bundle at `dc3635f`
studentbudgetwars: improved, committed sidecar observer bundle at `1a40f96`
```

ADMISSION-APP latest sidecar proof commits:

```txt
78236ec Refresh STAX page build observer proof
d623f09 Refresh ADMISSION STAX proof after sidecar commit
8b0aa91 Refresh ADMISSION STAX accept status
```

ADMISSION-APP current local page-build observer gate:

```txt
verdict: Accept
proof strength: Audit-grade
repo head: 8b0aa9168b72fb1b541cf29402bc7cdc8632d57e
status commit recorded by sidecar: d623f0948dfe96b5454befed263b93a00572f2fb
proof command: npm run build:pages -- --output /tmp/stax-admission-pages/index.html
boundary: this is local page-build proof only; no live target, sync, deploy, dataset validation, or visual readiness claim
note: the tracked `docs/index.html` mutation from a direct build was restored; current proof uses temporary output and leaves app/source/published output clean.
```

Brightspacequizexporter is now included as observer evidence on `main` at:

```txt
dc3635ff79b346035f5e179a0c8a6a06fbe74359
```

Brightspace sidecar status after the follow-up patch:

```txt
verdict: Accept
proof strength: Audit-grade
commit: dc3635ff79b346035f5e179a0c8a6a06fbe74359
```

The refreshed Brightspace bundle is now current-main evidence. STAX still records older historical command evidence, but current build, ingest, and Forensics 25 export proof are verified for the current auditable worktree. The Brightspace repo commit is pushed as `dc3635f Stabilize ingest promotion benchmarks`.

studentbudgetwars latest sidecar commits:

```txt
cbb4b5d Attach STAX observer sidecar
1a40f96 Refresh STAX observer proof status
```

studentbudgetwars current observer gate:

```txt
verdict: Accept
proof strength: Audit-grade
commit: 1a40f96f06cab0dca43ccf7b6ca85f31ba2d9758
scoped proof:
- compileall: exit 0
- data validation: exit 0
- scoped non-window pytest: 377 passed, 1 deselected, exit 0
boundary: full GUI/windowing suite is not claimed as passing
```

The studentbudgetwars sidecar attach decision is resolved: keep, commit, and pushed. The latest operating-window import uses `reports/pattern_promotion/attached_repo_exports/studentbudgetwars-impact-sidecar-accept.json`.

STAX gate note:

```txt
Do not collect ad hoc `node -e` artifact-verifier snippets or `git diff --cached --check` as STAX command evidence for this report lane. The command-evidence classifier treats those lanes as non-execution evidence. Prefer first-class project commands such as `npm run typecheck` plus generated report artifacts for the sidecar gate.
```

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
npm run pattern:impact -- --import <14 validated bundles>: pass, 14 imported bundles / 0 critical misses / 14 proof artifact requests
npm run typecheck: pass
npm test -- tests/sidecarWatchCollect.test.ts tests/projectControlProofStackIntegration.test.ts tests/sidecarClaimExtractionPrecision.test.ts tests/claimProofMapping.test.ts: pass, 64 tests
npm run stax:collect -- --repo /Users/deanguedo/Documents/GitHub/STAX -- npm test -- tests/sidecarWatchCollect.test.ts tests/projectControlProofStackIntegration.test.ts tests/sidecarClaimExtractionPrecision.test.ts tests/claimProofMapping.test.ts: pass
npm run stax:gate -- --repo /Users/deanguedo/Documents/GitHub/STAX: Accept / Audit-grade
npm test -- tests/proofSurfacePack.test.ts: pass, 15 tests
npm run typecheck: pass after the visual proof-surface patch
npm test: pass, 211 test files / 1110 tests
npm run smoke:stax: pass
npm run rax -- eval: pass, 16/16 evals
npm run typecheck: pass after stale command evidence speed fix
npm test -- tests/sidecarWatchCollect.test.ts tests/commandEvidenceLedger.test.ts: pass, 30 tests
npm run stax:collect -- --repo /Users/deanguedo/Documents/GitHub/STAX -- npm run typecheck: pass, evidence cmd_2026-05-28T03_10_15_896Z_982c1455e5e7
npm run stax:collect -- --repo /Users/deanguedo/Documents/GitHub/STAX -- npm test -- tests/sidecarWatchCollect.test.ts tests/commandEvidenceLedger.test.ts: pass, evidence cmd_2026-05-28T03_10_15_896Z_e74a24d6961a
npm run stax:collect -- --repo /Users/deanguedo/Documents/GitHub/STAX -- node -e <canvas gate expected-reject verifier>: pass, evidence cmd_2026-05-28T03_10_15_896Z_c6532a3cbd8b
direct timed Canvas gate after speed fix: exit 1 expected, completed in about 4.27s, reported stale-proof Reject / wrong_commit
STAX sidecar gate after speed fix: Accept / Audit-grade
fingerprint timing probe before ignored-file pathspec patch: about 26851ms
fingerprint timing probe after ignored-file pathspec patch: about 101ms
npm test -- tests/sidecarWatchCollect.test.ts -t "tracks ignored relevant source files": pass, 1 test
npm run stax:collect -- --repo /Users/deanguedo/Documents/GitHub/STAX -- npm run typecheck: pass after ignored-file pathspec patch
npm run stax:collect -- --repo /Users/deanguedo/Documents/GitHub/STAX -- npm test -- tests/sidecarWatchCollect.test.ts tests/commandEvidenceLedger.test.ts: pass after ignored-file pathspec patch
npm run stax:gate -- --repo /Users/deanguedo/Documents/GitHub/STAX --no-learning-event: Accept
```

GitHub Actions:

```txt
staxcore-strict on d1c51d7: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26544755416
staxcore-strict on 7a27a6f: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26548876800
staxcore-strict on 8b57c08: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26550889534
staxcore-strict on f9abe14: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26551263255
staxcore-strict on 4542860: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26552336710
staxcore-strict on b77067d: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26552985068
staxcore-strict on 9ab09ae: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26553584619
staxcore-strict on c2c80b9: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26553702048
staxcore-strict on c273432: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26553832572
staxcore-strict on 618589a: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26554382020
staxcore-strict on 6850708: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26563991531
staxcore-strict on 6418a4d: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26566859092
staxcore-strict on 92855f5: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26574143890
staxcore-strict on 03561cf: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26584579089
staxcore-strict on 1a87f23: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26585194796
staxcore-strict on abe74dd: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26585690325
staxcore-strict on 565b795: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26586591729
staxcore-strict on 7f60c86: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26586923779
staxcore-strict on 42c8552: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26587464633
staxcore-strict on 9d07174: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26587986194
staxcore-strict on 36a6af7: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26588513093
staxcore-strict on cb7882d: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26588840537
staxcore-strict on 54292bf: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26589405921
staxcore-strict on 9945855: success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26589788843
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

There is also a tracked historical duplicate handoff:

```txt
docs/ACTIVE_HANDOFF 2.md
```

Do not use it as the active restart source. Do not delete or reconcile it unless Dean explicitly asks.

Durable rollout files already committed and pushed in `5002d75`:

```txt
reports/pattern_promotion/attached_repo_exports/ADMISSION-APP-impact-current-build.json
reports/pattern_promotion/attached_repo_exports/STAX-impact-current-fingerprint.json
reports/pattern_promotion/attached_repo_exports/studentbudgetwars-impact-syntax-env.json
reports/pattern_promotion/pattern-promotion-impact-2026-05-27T22-51-28-732Z.json
```

Latest attached-repo operating-window artifacts:

```txt
reports/pattern_promotion/attached_repo_exports/studentbudgetwars-impact-sidecar-accept.json
reports/pattern_promotion/pattern-promotion-impact-2026-05-28T04-09-40-745Z.json
reports/pattern_promotion/attached_repo_exports/ADMISSION-APP-impact-page-build-accept.json
reports/pattern_promotion/pattern-promotion-impact-2026-05-28T04-45-19-743Z.json
reports/pattern_promotion/attached_repo_exports/brightspacequizexporter-impact-ingest-stabilized-2026-05-28.json
reports/pattern_promotion/pattern-promotion-impact-2026-05-28T12-15-17-138Z.json
docs/RAX_PATTERN_PROMOTION_IMPACT_REPORT.md
docs/ACTIVE_HANDOFF.md
src/evidence/CommandEvidenceIntelligence.ts
tests/commandEvidenceIntelligence.test.ts
vitest.config.ts
```

Older intermediate impact JSON files from that run were superseded and left out; keep using the final `pattern-promotion-impact-2026-05-27T22-51-28-732Z.json` unless a fresh `npm run pattern:impact` run replaces it.

Attached repo dirt created by observer work:

```txt
/Users/deanguedo/Documents/GitHub/ADMISSION-APP
- generated `.stax` status/proof files dirty
- previously generated `docs/index.html` diff was restored clean on this workstation

/Users/deanguedo/Documents/GitHub/canvas-helper
- pushed commit `16749182 Keep smoke pipeline proof runs isolated`
- approved sidecar proof surfaces updated to avoid mutating visual proof recommendations
- `npm run smoke:pipeline` now uses scratch `smoke-local-pipeline-*` output and defaults intelligence to `off`
- generated `.stax` status/proof files dirty
- earlier `.runtime/memory-ledger.json` and `projects/resources/smoke-calm-module/**` smoke output was cleaned
- Canvas sidecar is currently `Accept / Audit-grade`

/Users/deanguedo/Documents/GitHub/studentbudgetwars
- .gitignore changed by STAX attach
- AGENTS.md created by STAX attach
- .stax/ sidecar created
- ignored local `.venv` was repaired with project dev dependencies
- useful observer proof exists for narrowed non-window pytest and data validation
- full suite is not claimed because local Tcl/Tk/windowing failures remain
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
14 imported bundles
0 critical misses
14/14 full handoff contracts
14/14 proof artifact requests
13/14 cleanup prompts needed
```

Immediate next action after this handoff refresh is committed/pushed:

```txt
Continue attached-repo operating-window evidence and local dirt decisions from the verified STAX baseline named in the top Latest Restart Note.
```

Next best actions:

1. Use the top Latest Restart Note as the current verified STAX rollout baseline.
2. Treat the Canvas smoke-path cleanup as already pushed; do not repeat the old cleanup decision.
3. For Canvas Helper, current-head command proof is refreshed and the sidecar gate is `Accept / Audit-grade`; use the latest Canvas bundle unless the Canvas worktree changes.
4. For Brightspacequizexporter, use pushed commit `dc3635f` and the `brightspacequizexporter-impact-ingest-stabilized-2026-05-28.json` bundle unless the repo changes.
5. ADMISSION-APP current non-mutating page-build proof is refreshed and sidecar status is `Accept / Audit-grade`; do not repeat unless that repo changes.
6. studentbudgetwars sidecar attach is kept, committed, pushed, and refreshed to `Accept / Audit-grade`; do not repeat unless that repo changes.
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

Current published baseline before this handoff refresh:
- commit: 994585538b29d96157e5fa67aba693114513c766
- short: 9945855
- commit message: Refresh handoff after status staleness fix
- GitHub Actions strict run: success
- CI URL: https://github.com/deanguedo-arch/STAX/actions/runs/26589788843

Goal:
Continue the attached-repo operating-window phase from the top Latest Restart Note baseline. STAX, ADMISSION-APP, Canvas Helper, Brightspacequizexporter, and studentbudgetwars are imported into the current impact report. Current operating-window status is 14 imported bundles, 0 critical misses, 14/14 full handoff contracts, 14/14 proof artifacts requested, and 13/14 cleanup prompts needed. Canvas Helper's smoke proof path is pushed at `16749182`; studentbudgetwars sidecar attach is committed and pushed at `1a40f96`; Brightspacequizexporter is pushed at `dc3635f` with sidecar `Accept / Audit-grade`. The CI-only turn-compliance mtime false reject, mutating visual proof recommendation, vague visual proof-surface prompt issue, Python command proof-lane normalization issue, Canvas stale-command-evidence gate stall, ignored-file worktree fingerprint slowdown, stale Canvas current-head proof, studentbudgetwars sidecar attach decision, Brightspace isolated ingest promotion benchmark issue, and raw sidecar-learning candidate queue closure are all covered in the current operating-window evidence.

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
docs/RAX_PATTERN_PROMOTION_IMPACT_REPORT.md reflects the 14-bundle operating-window status
origin/main equals local main
GitHub staxcore-strict remains success on the pushed commit
tracked .stax proof/status files either reflect the final gate or remain unchanged intentionally
```
