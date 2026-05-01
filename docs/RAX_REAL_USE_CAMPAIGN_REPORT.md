# RAX Real Use Campaign Report

Date started: 2026-04-28

## Purpose

STAX now has strong proof gates, operator wiring, formatter decomposition, and
builder/adaptor stabilization. The next proof is not another architecture pass.
The next proof is whether Dean can use STAX repeatedly under real project
pressure without fighting the machine.

This report tracks a real-use campaign. It must not count fixture editing,
synthetic benchmark prompts, simulated tasks, or architecture-only validation
as usage proof.

## Campaign Status

- Status: scoped_9_5_claim_earned
- Real sessions recorded: 10/10 (project-control campaign run)
- Distinct repos used: 3/3
- Fixture edits during counted sessions: not_allowed
- Current proof level: real_use_proven_for_scoped_project_control_workflow
- Browser capture progress: 10/10 ChatGPT subscription outputs captured and scored in `fixtures/real_use/phase11_subscription_capture.json`

Fresh investor proof round progress:

- runId: `investor-proof-10-2026-05-01`
- STAX outputs refreshed: 10/10
- ChatGPT outputs captured: 10/10
- executable scoring complete: yes

Scored summary (2026-04-30T14:17:41.208Z):

- STAX wins: 1
- ChatGPT wins: 0
- Ties: 9
- STAX critical misses: 0
- ChatGPT critical misses: 1

Phase 12 integrity-locked run (2026-04-30):

- runId: `phase12-stateful-2026-04-30`
- integrity command: `npm run campaign:integrity -- --run=phase12-stateful-2026-04-30`
- integrity status: passed
- run folder: `fixtures/real_use/runs/phase12-stateful-2026-04-30`
- summary:
  - Total scored cases: 10
  - STAX wins: 1
  - ChatGPT wins: 0
  - Ties: 9
  - STAX critical misses: 0
  - ChatGPT critical misses: 1

Phase B stateful advantage run (2026-04-30):

- runId: `phaseB-stateful-20-2026-04-30`
- integrity command: `npm run campaign:integrity -- --run phaseB-stateful-20-2026-04-30`
- integrity status: passed
- run folder: `fixtures/real_use/runs/phaseB-stateful-20-2026-04-30`
- summary:
  - Total scored cases: 20
  - STAX wins: 0
  - ChatGPT wins: 0
  - Ties: 20
  - STAX critical misses: 0
  - ChatGPT critical misses: 0
- interpretation: safe no-loss stateful comparison, not decisive superiority.

Phase B executable rerun (current local STAX against captured ChatGPT baseline):

- command sequence:
  - `npm run campaign:phaseB:refresh -- --run phaseB-stateful-20-2026-04-30`
  - `npm run campaign:phaseB:score -- --run phaseB-stateful-20-2026-04-30`
- artifact:
  - `fixtures/real_use/runs/phaseB-stateful-20-2026-04-30/executable_benchmark_summary.json`
- summary:
  - Total scored cases: 20
  - STAX wins: 7
  - ChatGPT wins: 0
  - Ties: 13
  - STAX critical misses: 0
- interpretation:
  - The executable STAX rerun is now ahead on this slice.
  - This is still not enough for a 9+ or 9.5 claim because the external side is a captured baseline, not a fresh live rerun in the current turn, and the real-use cleanup gates remain blocked.

Dogfood 10-task loop (2026-04-30):

- ledger: `fixtures/real_use/dogfood_10_tasks_2026-04-30.json`
- real tasks recorded: 10/10
- repos represented: 4 (`ADMISSION-APP`, `brightspacequizexporter`, `canvas-helper`, `STAX`)
- current STAX critical misses: 0
- executable integrity command: `npm run campaign:real-use:integrity`
- executable integrity status: `promotion_blocked`
- current replay command: `npm run campaign:real-use:replay`
- current replay status: `passed` (10/10 historical dogfood tasks now hit the expected current proof lane)
- computed ledger summary:
  - meaningful catches: 10/10
  - fake-complete catches: 9/10
  - missing-proof catches: 10/10
  - wrong-repo prevented: 5/10
  - cleanup prompts after Codex: 7
  - useful initial STAX prompts: 3/10
  - accepted human decisions: 8/10
- promotion blockers:
  - not every task has an accepted human decision
  - fewer than 8 useful initial STAX prompts recorded
- replay interpretation:
  - The historical first-prompt ledger remains unchanged and promotion-blocked.
  - Current STAX behavior now passes the replay gate for the same 10 task prompts.
  - The next proof must come from a fresh real-use round, not by rewriting the old ledger.
- meaningful catches so far:
  - ADMISSION-APP publish/sync proof stayed blocked after a missing `pwsh` preflight.
  - canvas-helper Sports Wellness visual readiness required rendered proof instead of source/CSS-only claims.
  - STAX commit-readiness self-audit exposed and then fixed cross-context leakage from prior app-repo evidence.
  - ADMISSION-APP scrape/data correctness stayed separate from Sheets publish safety and surfaced sparse app-consumed field coverage.
  - A supplied ADMISSION-APP coverage audit now advances to the first concrete data gap instead of looping on the same audit.
  - The first Avg_Total gap trace found 101 canonical rows with `Min_Avg_Final` but blank `Avg_Total`, only one candidate row, and URL/credential drift in a concrete NAIT example.
  - ADMISSION-APP Avg_Total gap reports no longer route to Sheets publish/sync just because the safety boundary mentions not publishing or syncing.
  - Brightspace dependency readiness stayed scoped to the Brightspace repo and required `npm ls @rollup/rollup-darwin-arm64 rollup vite` before build/ingest claims.
  - Brightspace dependency inspection, `npm run build`, and `npm run ingest:ci` all passed; proof commands did not create new tracked Brightspace changes.
  - STAX dogfood campaign self-audit now accepts supplied local validation evidence while still refusing to call a 9/10 ledger complete.
- latest validation evidence:
  - `npm run typecheck`: passed
  - `npm test`: passed, 122 files and 602 tests
  - `npm run rax -- eval`: passed, 16/16
  - fitness smoke: passed
- proof artifacts for Task 2:
  - `fixtures/real_use/artifacts/real_codex_002_sportswellness_phase1_viewport.png`
  - `fixtures/real_use/artifacts/real_codex_002_sportswellness_smart_goals.png`
  - `fixtures/real_use/artifacts/real_codex_002_sportswellness_mark_complete.png`

Latest campaign evidence:

```txt
docs/RAX_PHASE10_REAL_WORKFLOW_REPORT.md
docs/RAX_PHASE11_SUBSCRIPTION_COMPARISON_REPORT.md
runs/real_use_campaign/2026-04-30/phase10_campaign_2026-04-30T03-55-54-271Z.json
runs/real_use_campaign/2026-04-30/phase10_campaign_2026-04-30T03-55-54-271Z.md
runs/real_use_campaign/2026-04-30/phase10_campaign_2026-04-30T12-26-53-290Z.json
runs/real_use_campaign/2026-04-30/phase10_campaign_2026-04-30T12-26-53-290Z.md
runs/real_use_campaign/2026-04-30/phase11_subscription_comparison_2026-04-30T12-26-52-244Z.json
runs/real_use_campaign/2026-04-30/phase11_subscription_comparison_2026-04-30T12-26-52-244Z.md
runs/real_use_campaign/2026-04-30/phase10_campaign_2026-04-30T12-27-54-600Z.json
runs/real_use_campaign/2026-04-30/phase10_campaign_2026-04-30T12-27-54-600Z.md
runs/real_use_campaign/2026-04-30/phase11_subscription_comparison_2026-04-30T12-27-53-647Z.json
runs/real_use_campaign/2026-04-30/phase11_subscription_comparison_2026-04-30T12-27-53-647Z.md
runs/real_use_campaign/2026-04-30/phase10_campaign_2026-04-30T13-12-34-160Z.json
runs/real_use_campaign/2026-04-30/phase10_campaign_2026-04-30T13-12-34-160Z.md
runs/real_use_campaign/2026-04-30/phase11_subscription_comparison_2026-04-30T13-12-33-363Z.json
runs/real_use_campaign/2026-04-30/phase11_subscription_comparison_2026-04-30T13-12-33-363Z.md
runs/real_use_campaign/2026-04-30/phase10_campaign_2026-04-30T14-16-50-034Z.json
runs/real_use_campaign/2026-04-30/phase10_campaign_2026-04-30T14-16-50-034Z.md
runs/real_use_campaign/2026-04-30/phase11_subscription_comparison_2026-04-30T14-17-41-208Z.json
runs/real_use_campaign/2026-04-30/phase11_subscription_comparison_2026-04-30T14-17-41-208Z.md
fixtures/real_use/phase11_subscription_capture.json
fixtures/real_use/phase11_subscription_scores.json
fixtures/real_use/runs/phase12-stateful-2026-04-30/manifest.json
fixtures/real_use/runs/phase12-stateful-2026-04-30/cases.json
fixtures/real_use/runs/phase12-stateful-2026-04-30/captures.json
fixtures/real_use/runs/phase12-stateful-2026-04-30/scores.json
fixtures/real_use/runs/phase12-stateful-2026-04-30/report.md
fixtures/real_use/runs/phaseB-stateful-20-2026-04-30/manifest.json
fixtures/real_use/runs/phaseB-stateful-20-2026-04-30/cases.json
fixtures/real_use/runs/phaseB-stateful-20-2026-04-30/captures.json
fixtures/real_use/runs/phaseB-stateful-20-2026-04-30/scores.json
fixtures/real_use/runs/phaseB-stateful-20-2026-04-30/report.md
fixtures/real_use/runs/phaseB-stateful-20-2026-04-30/executable_benchmark_summary.json
fixtures/real_use/failure_ledger.json
fixtures/real_use/baseline_cleanup_tasks.json
fixtures/real_use/dogfood_round_c_10_tasks.json
fixtures/real_use/operating_window_30_tasks.json
```

Current 9.5 gate snapshot (2026-05-01):

- `npm run campaign:baseline`: `baseline_ready`
- `npm run campaign:failures`: `tracked`
- `npm run campaign:dogfood:c`: `round_c_passed`
- `npm run campaign:operating-window`: `operating_window_passed`
- `npm run campaign:promotion-gate`: `promotion_ready`
- internal blockers: none
- external verdict: scoped 9.5 approved for Dean's Codex/repo project-control
  workflow after the fresh investor round

Investor proof run (2026-05-01):

- run folder:
  `fixtures/real_use/runs/investor-proof-10-2026-05-01`
- fixture source:
  `fixtures/manual_benchmark/stax_vs_raw_chatgpt_investor_10_cases.json`
- commands:
  - `npm run campaign:investor:prepare -- --run investor-proof-10-2026-05-01`
  - `npm run campaign:investor:refresh -- --run investor-proof-10-2026-05-01`
  - `npm run campaign:investor:score -- --run investor-proof-10-2026-05-01`
- summary:
  - Total scored cases: 10
  - STAX wins: 7
  - ChatGPT wins: 0
  - Ties: 3
  - no external baseline rows: 0
  - superiority status: `not_proven`
- interpretation:
  - This is enough for the scoped workflow claim because STAX produced a clean
    no-loss result with a positive win margin on fresh cases.
  - This is not enough to claim broad superiority over ChatGPT.

External judge result:

- thread reviewed the fresh investor proof pack plus the standing promotion-gate
  evidence
- verdict: yes
- score: 9.5 / 10
- allowed claim:
  - STAX is 9.5 for Dean's Codex/repo project-control workflow
- still blocked:
  - general "beats ChatGPT" claim
  - production-ready claim
  - arbitrary-domain claim

## External Comparison Starter

Before expanding this campaign into a larger benchmark, run the five-case manual
STAX vs ChatGPT comparison:

```txt
docs/RAX_STAX_VS_CHATGPT_MANUAL_BENCHMARK.md
fixtures/manual_benchmark/stax_vs_chatgpt_seed_5_cases.json
```

This starter does not prove superiority. It checks whether STAX can beat raw
ChatGPT on five real project-control tasks with zero STAX critical misses. If
STAX loses a case, the loss becomes an eval or concrete patch target before the
campaign expands.

## Session 1 Candidate

Repo: `brightspacequizexporter`

Candidate task: unblock Brightspace ingest trust.

Why this is the right first real-use target:

- Dean is actively experiencing friction in this repo.
- Prior STAX dogfood found a repeated failed-proof loop around `npm run
  ingest:ci`.
- Brightspace repo rules say reviewed fixtures are truth, parser snapshots are
  candidate-only, and the canonical ingest gate is `npm run ingest:ci`.
- The live repo is on `main...origin/main` with one worktree ambiguity:
  `D tmp/.gitkeep`.
- This machine is `darwin arm64`.
- Read-only dependency inspection showed `node_modules/@rollup/rollup-darwin-arm64`
  is missing while `node_modules/@rollup/rollup-darwin-x64` is present.
- `package-lock.json` expects both Rollup optional native packages, including
  `@rollup/rollup-darwin-arm64@4.59.0`.

Team consensus:

- Red Team: do not let STAX score Brightspace fixtures while the repo remains
  broken; benchmark-shaped progress is the main false-progress risk.
- Blue Team: the concrete blocker is install/build integrity before the ingest
  gate can prove anything; the next action must not be generic `npm test`.
- Green Team: useful real work means Dean does not have to re-explain the repo;
  Codex should get a narrow repair packet and return command evidence.

Current STAX behavior:

- Without fresh dependency-inspection evidence, STAX asks for:
  `npm ls @rollup/rollup-darwin-arm64 rollup vite`.
- After the dependency-inspection output is supplied back to STAX, it correctly
  moves to a human approval boundary before dependency repair.

Session 1 should not count yet. It counts only after:

- Dean approves dependency/install repair;
- Codex repairs only the install/build blocker first;
- `npm run ingest:ci` is run afterward;
- the outcome is recorded as either a passing gate or one concrete failing
  manifest/test/parser area;
- no benchmark fixture is edited to make STAX look better.

Bounded Codex prompt for Session 1:

```txt
In /Users/deanguedo/Documents/GitHub/brightspacequizexporter, repair only the dependency/install integrity blocker for the missing Rollup native optional package on darwin arm64.

Scope:
- This is an install/dependency integrity repair only.
- Do not edit parser/source logic.
- Do not edit reviewed fixtures.
- Do not edit gold/benchmark data.
- Do not run ingest:seed-gold.
- Do not broaden scope.

Allowed tracked file changes:
- package-lock.json only if lockfile repair is required.
- package.json only if absolutely necessary and explicitly justified.
- tmp/.gitkeep only to preserve or explicitly resolve its current deletion.

Forbidden tracked file changes:
- src/**
- scripts/**
- reviewed fixtures
- benchmark/gold data
- parser logic
- ingest promotion logic
- tests, unless the test failure is unrelated and explicitly approved later

Before repair:
1. Run `npm ls @rollup/rollup-darwin-arm64 rollup vite`.
2. Report the output and whether the native optional package is missing from install state, lockfile state, or both.

Repair:
- Use the smallest dependency/install repair needed.
- Do not change app behavior.
- Do not change ingest logic.
- Do not change tests.

After repair, run:
1. `npm run build`
2. `npm run ingest:ci`

Report:
- exact files changed
- exact commands run
- command outputs
- whether `tmp/.gitkeep` was preserved or intentionally resolved
- first remaining failure if either gate still fails
- if no tracked files changed, say that clearly
```

Accept the run only if:

- no source, parser, script, fixture, benchmark/gold, or test files changed;
- `package-lock.json` and any `package.json` changes are explainable and
  limited to dependency/install integrity;
- `tmp/.gitkeep` is preserved or explicitly resolved;
- `npm run build` output is supplied;
- `npm run ingest:ci` output is supplied;
- the first remaining failure is reported if a gate still fails.

Reject the run if:

- Codex changes parser logic, app source, ingest scripts, tests, fixtures, or
  benchmark/gold data without a separate explicit approval;
- Codex runs `ingest:seed-gold`;
- Codex claims success without command output;
- Codex ignores `tmp/.gitkeep`;
- Codex fixes ingest behavior before proving dependency repair.

Rejected for Session 1:

- More STAX proof-gate machinery.
- Benchmark fixture polishing.
- Broad superiority claims.
- Generic "run all tests and fix issues" work.
- `ingest:seed-gold` as a fix for reviewed expected fixtures.

## Entry Criteria

A session counts only if all of these are true:

- Dean brought a real task from current project work.
- STAX produced a recommendation, evidence request, audit, or bounded prompt.
- Dean or Codex took an actual next action based on the STAX output.
- The outcome was recorded honestly, including friction and failures.
- No benchmark fixture was edited during the session.
- No result was upgraded into broad superiority proof.

## What To Record

For every counted session, record:

- Task
- Repo
- STAX recommendation
- Action taken
- Outcome
- Time saved or wasted
- Failure mode
- Correction needed
- Whether Codex acted better because of the STAX output
- Whether Dean had to fight the system

## Session Table

| # | Date | Repo | Task | STAX Recommendation | Action Taken | Outcome | Time Saved/Wasted | Failure Mode | Correction Needed | Codex Improved? | Dean Fought System? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-04-30 | ADMISSION-APP | Publish/sync readiness proof | Run one non-publishing preflight, do not accept publish readiness without proof | Located `tools/validate-sync-surface.ps1`; preflight blocked because `pwsh` is unavailable | Clean failure | Saved cleanup by avoiding publish/sync/deploy attempts | Initial answer drifted to iOS/TestFlight context | Patched project-control targeting and clean-failure wording | Yes | Briefly |
| 2 | 2026-04-30 | canvas-helper | Sports Wellness visual readiness proof | Require rendered preview/screenshot proof for text fit, border symmetry, and checkmark containment | Used in-app browser on Sports Wellness preview; captured screenshots; ran `npm run build:studio` | Verified next state | Saved cleanup by requiring visual artifact before accepting UI readiness | Initial answer leaked Brightspace context | Patched canvas-helper visual-proof targeting regression | Yes | No |
| 3 | 2026-04-30 | STAX | Current uncommitted campaign changes before commit | Review STAX diff and rerun typecheck, tests, eval before commit-ready claim | Patched STAX-lane targeting; ran focused regressions plus full required validation | Verified next state | Saved cleanup by catching wrong-context self-audit before commit | Initial answer leaked ADMISSION-APP/TestFlight context | Added narrow STAX commit-readiness regression | Yes | Briefly |
| 4 | 2026-04-30 | ADMISSION-APP | Scrape/data correctness for the built app | Run data-contract and coverage audit before any correctness claim | Ran schema validation plus Avg_Total, enrichment-link, and NAIT filter fixture checks; measured canonical blank rates | Clean failure | Saved cleanup by separating valid schema from useful coverage | Initial answer routed to Sheets publish/sync | Added scrape/data correctness regression | Yes | Briefly |
| 5 | 2026-04-30 | ADMISSION-APP | Audit supplied scrape/data coverage report | Trace first concrete data gap instead of rerunning same audit | Patched supplied-coverage detection and reran project_control | Verified next state | Saved one redundant audit loop | Initial answer repeated the same audit step | Added supplied coverage audit regression | Yes | Briefly |
| 6 | 2026-04-30 | ADMISSION-APP | Trace first Avg_Total gap | Verify one narrow coverage blocker without mutation | Found 101 canonical min-average rows with blank Avg_Total; candidate artifact has 1 row; Water/Wastewater has URL/credential drift | Clean failure | Saved cleanup by identifying extraction/candidate coverage as blocker | None | None | Yes | No |
| 7 | 2026-04-30 | ADMISSION-APP | Audit Avg_Total gap report | Stay on data-gap lane and pick one bounded trace/fix prompt | Patched Avg_Total/identity-drift intent detection and reran project_control | Verified next state | Saved cleanup by avoiding Sheets publish/sync detour | Initial answer routed to Sheets publish/sync | Added Avg_Total gap routing regression | Yes | Briefly |
| 8 |  |  |  |  |  |  |  |  |  |  |  |
| 9 |  |  |  |  |  |  |  |  |  |  |  |
| 10 |  |  |  |  |  |  |  |  |  |  |  |

## Session Template

```txt
Session:
Date:
Repo:
Dean task:
STAX entrypoint used:
STAX recommendation:
Evidence STAX used:
Evidence STAX requested:
Action taken:
Outcome:
Time saved/wasted:
Failure mode:
Correction needed:
Did Codex act better because of it:
Did Dean have to fight the system:
Counts toward campaign: yes/no
Reason:
```

## Scoring Rubric

### Useful

Count as useful if STAX did at least one of:

- picked a better next action than a generic assistant answer;
- prevented a fake-complete claim;
- routed Codex toward exact files, commands, or proof;
- reduced Dean's decision burden;
- made a visual/runtime/evidence gap clear enough to act on;
- saved time in the actual work loop.

### Not Useful

Count as not useful if STAX:

- asked for excessive evidence without improving the next action;
- returned process language instead of a usable answer;
- hid uncertainty or overclaimed proof;
- made Dean translate machine governance into real work;
- caused Codex to act worse or slower;
- required fixture or report editing to appear successful.

### Disqualifying

Do not count the session if:

- it is a benchmark fixture task;
- it is a synthetic prompt designed only to satisfy this report;
- no real next action was taken;
- the result depends on edited benchmark data;
- STAX mutates a linked repo directly;
- STAX promotes memory, evals, training, policies, schemas, or modes without
  explicit approval.

## Campaign Acceptance Criteria

The campaign can support a real-use usefulness claim only if:

- 10/10 sessions are recorded;
- at least 3 distinct repos are represented;
- at least 7 sessions are useful by the rubric above;
- no disqualifying session is counted;
- failure modes are preserved instead of hidden;
- at least one correction is produced for repeated friction;
- the final status remains separate from benchmark superiority.

## Proof Boundary

This campaign can show:

- real-use usefulness;
- operator friction;
- whether STAX improves Codex handoffs;
- whether STAX saves or wastes Dean's time.

This campaign cannot show:

- global superiority over ChatGPT;
- autonomous repo-fixing maturity;
- linked-repo test success without command evidence;
- visual correctness without visual artifacts;
- safety of execution lanes.

## Current Conclusion

Early dogfood signal exists, but the 10-task claim is not proven yet. The first
seven real tasks show STAX is useful as a project-control layer when it forces
proof boundaries, catches missing proof, and turns misses into regressions. The
campaign still needs 3 more real tasks, zero critical misses, and a downward
cleanup-burden trend before making a stronger real-use claim.

## Validation

Commands run for this doc-only tracking surface:

```bash
npm run typecheck
npm test
npm run rax -- eval
npm run rax -- eval --regression
npm run rax -- eval --redteam
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
```

Results:

- Typecheck: passed.
- Tests: 67 files, 338 tests passed.
- Main eval: 16/16 passed.
- Regression eval: 47/47 passed.
- Redteam eval: 9/9 passed.
- STAX fitness smoke: passed with a run artifact under `runs/2026-04-28/`.

Additional read-only Session 1 candidate checks:

```bash
git status --short --branch
npm ls @rollup/rollup-darwin-arm64 rollup vite
npm run rax -- chat --once "What is the biggest current operating risk in brightspacequizexporter?"
npm run rax -- chat --once "what tests exist in brightspacequizexporter and what proof is missing?"
npm run rax -- chat --once "For workspace brightspacequizexporter: prior command evidence says npm run ingest:ci failed during build with Cannot find module @rollup/rollup-darwin-arm64 from node_modules/rollup/dist/native.js. I then ran npm ls @rollup/rollup-darwin-arm64 rollup vite in /Users/deanguedo/Documents/GitHub/brightspacequizexporter. It exited 0. Output listed vite@7.3.1 and rollup@4.59.0 under vite/vitest, but did not list @rollup/rollup-darwin-arm64. What is the real next move?"
```

Result: candidate only. These checks identified the real work, but they do not
prove Brightspace is repaired.
