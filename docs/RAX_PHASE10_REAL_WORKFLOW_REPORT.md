# RAX Phase 10 Real Workflow Report

Date: 2026-04-30

## Purpose

Run the 10-task real workflow campaign using STAX as the project-control layer,
track fake-complete catches and cleanup burden, and convert repeated misses into
regression coverage.

## What Was Added

```txt
fixtures/real_use/phase10_real_workflow_10_tasks.json
scripts/runPhase10Campaign.ts
package script: npm run campaign:phase10
evals/regression/project_control_bounded_prompt_not_generic.json
```

## Campaign Run

Command:

```bash
npm run campaign:phase10
```

Latest artifact:

```txt
runs/real_use_campaign/2026-04-30/phase10_campaign_2026-04-30T03-50-20-737Z.json
runs/real_use_campaign/2026-04-30/phase10_campaign_2026-04-30T03-50-20-737Z.md
```

Latest summary:

```txt
taskCount: 10
distinctReposUsed: 3
usefulSessions: 10/10
fakeCompleteCaught: 2/2
totalCleanupPromptsNeeded: 0
uniqueOneNextActions: 9/10
uniqueOutputShapes: 9/10
campaignStatus: real_use_candidate
```

## Important Caveat

The runtime provider for this run is mock, so this campaign is candidate-only:

```txt
Generator provider is mock; campaign quality should be treated as candidate-only.
```

Phase 10 campaign plumbing is complete, but real-use quality is not promotion
proof until this campaign is rerun with a non-mock generator provider.

## Repeated-Miss Conversion

The repeated generic next-action fallback was converted into a regression guard:

```txt
evals/regression/project_control_bounded_prompt_not_generic.json
```

This blocks the prior generic fallback phrase for bounded prompt tasks.

## Validation

```bash
npm run typecheck
npm test
npm run rax -- eval
npm run rax -- eval --regression
npm run rax -- eval --redteam
npm run validate:staxcore:strict
npm run campaign:phase10
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
```
