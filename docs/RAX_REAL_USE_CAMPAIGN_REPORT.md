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

- Status: not_started
- Real sessions recorded: 0/10
- Distinct repos used: 0/3
- Fixture edits during counted sessions: not_allowed
- Current proof level: real_use_not_proven

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
