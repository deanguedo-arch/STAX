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

- Status: phase11_subscription_comparison_scored_no_losses
- Real sessions recorded: 10/10 (project-control campaign run)
- Distinct repos used: 3/3
- Fixture edits during counted sessions: not_allowed
- Current proof level: real_use_candidate (no-loss comparison achieved; decisive-win loop still required)
- Browser capture progress: 10/10 ChatGPT subscription outputs captured and scored in `fixtures/real_use/phase11_subscription_capture.json`

Scored summary (2026-04-30T14:17:41.208Z):

- STAX wins: 1
- ChatGPT wins: 0
- Ties: 9
- STAX critical misses: 0
- ChatGPT critical misses: 1

Latest campaign evidence:

```txt
docs/RAX_PHASE10_REAL_WORKFLOW_REPORT.md
docs/RAX_PHASE11_PROVIDER_COMPARISON_REPORT.md
docs/RAX_PHASE11_SUBSCRIPTION_COMPARISON_REPORT.md
runs/real_use_campaign/2026-04-30/phase10_campaign_2026-04-30T03-55-54-271Z.json
runs/real_use_campaign/2026-04-30/phase10_campaign_2026-04-30T03-55-54-271Z.md
runs/real_use_campaign/2026-04-30/phase11_provider_comparison_2026-04-30T03-55-53-529Z.json
runs/real_use_campaign/2026-04-30/phase11_provider_comparison_2026-04-30T03-55-53-529Z.md
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
```

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
| 1 |  |  |  |  |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |  |  |  |  |  |
| 6 |  |  |  |  |  |  |  |  |  |  |  |
| 7 |  |  |  |  |  |  |  |  |  |  |  |
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

No real-use claim is proven yet. STAX has strong architecture and validation,
but this report remains empty until real project sessions are recorded.

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
