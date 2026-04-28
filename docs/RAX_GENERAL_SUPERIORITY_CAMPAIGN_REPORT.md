# RAX General Superiority Campaign Report

Date: 2026-04-28

## Purpose

The local repo benchmark had already proven strong bounded repo-task behavior,
but the larger goal is broader superiority against external ChatGPT-style
answers. This campaign extends the proof surface beyond repo operations into:

- strategy
- creative ideation
- teaching/course design
- research synthesis
- writing/editing
- planning/prioritization
- code implementation planning
- personal/project memory
- tool/document work
- self-improvement
- messy judgment
- local repo operation

## What Changed

Created a broad blind campaign batch:

- `fixtures/problem_benchmark/locked/general_superiority_campaign_v1_160.stax_locked.json`
- `fixtures/problem_benchmark/candidates/general_superiority_campaign_v1_external_prompt_batches.json`
- `fixtures/problem_benchmark/general_superiority_campaign_v1_160_tasks.json`

The locked fixture freezes STAX answers before external capture. External
answers were captured from the open ChatGPT STAX browser thread in eight prompt
batches on 2026-04-28.

## Campaign Result

The new 160-case batch passed its slice:

```txt
Total: 160
STAXBetter: 160
ExternalBetter: 0
Ties: 0
NoLocalBasis: 0
NoExternalBaseline: 0
ExpectedMismatches: 0
StopConditionMet: true
SuperiorityStatus: slice_only
ContinueLoopRequired: true
```

The full problem benchmark directory now reaches the local benchmark's
candidate threshold:

```txt
Total: 250
STAXBetter: 250
ExternalBetter: 0
Ties: 0
NoLocalBasis: 0
NoExternalBaseline: 0
SuperiorityStatus: superiority_candidate
```

## Stricter General Gate

The stricter general-superiority gate still does not allow a final claim:

```txt
Status: campaign_slice
Comparisons: 250/250
BlindComparisons: 160/250
WorkLanes: 14/12
TaskFamilies: 224/12
ReposOrDomains: 9/7
ExternalSources: 4/2
CaptureDates: 2/3
ExternalBetter: 0
Ties: 0
NoLocalBasis: 0
NoExternalBaseline: 0
ExpectedMismatches: 0
```

Remaining gaps:

```txt
Need at least 250 locked-before-external blind comparisons; current 160.
Need external baselines captured on at least 3 dates; current 2.
```

This distinction matters. The local benchmark now says this is a candidate
slice, but the general gate keeps the product claim blocked until there are
more blind comparisons and another capture date.

## What This Proves

STAX now beats the captured external baseline on:

- all prior real-repo slices
- the corrected fresh holdout slice
- the new 160-case broad campaign batch

It also covers the broad lanes that were previously missing. The improvement is
not just another receipt layer; it is a larger external comparison campaign.

## What This Does Not Prove

- It does not prove permanent general superiority.
- It does not prove performance against future uncaptured ChatGPT answers.
- It does not prove the broad campaign is immune to benchmark wording effects.
- It does not satisfy the stricter blind-count or three-date gates.
- It does not promote memory, training data, policies, schemas, modes, or source
  mutations.

## Next Required Slice

Create another blind batch of at least 90 cases and capture external baselines
on a third date/context. Do not edit STAX answers after scoring. Any
`external_better`, `tie`, `no_local_basis`, or `no_external_baseline` result
must become a correction candidate before rerun.

## Commands

```txt
npm run typecheck: passed
npm test: 52 files / 246 tests passed
npm run rax -- eval: 16/16 passed
npm run rax -- eval --regression: 46/46 passed
npm run rax -- eval --redteam: 9/9 passed
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes.": passed; run-2026-04-28T12-30-34-441Z-9xs6ep
npm run rax -- compare benchmark --file fixtures/problem_benchmark/general_superiority_campaign_v1_160_tasks.json: passed; 160/160 STAXBetter
npm run rax -- superiority status --fixtures fixtures/problem_benchmark: campaign_slice; 250 comparisons; 0 losses; 0 ties
```
