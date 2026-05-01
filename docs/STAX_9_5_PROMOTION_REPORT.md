# STAX 9.5 Promotion Report

Date: 2026-05-01

## Status

Promotion gate status: `promotion_ready`

Current allowed claim:

> STAX has earned a scoped 9.5 claim for Dean's Codex/repo project-control
> workflow based on clean promotion-gate evidence, zero critical misses, fresh
> investor-round comparison artifacts, useful initial prompts, accepted
> decisions, comparison-integrity gates, and measured cleanup-burden reduction.

Current blocked claim:

> STAX beats ChatGPT generally, is production-ready, or is proven outside the
> scoped Codex/repo project-control workflow.

This report stays strict. The internal promotion gate remains necessary, and the
fresh investor proof round now supplies the externally credible, artifact-rich
comparison pack that the outside judge previously required.

## Gate Snapshot

Live command:

```bash
npm run campaign:promotion-gate
```

Current result:

- `cleanRunsPassed`: 3 / 3
- `baselineStatus`: `baseline_ready`
- `dogfoodRoundCStatus`: `round_c_passed`
- `failureLedgerStatus`: `tracked`
- `operatingWindowStatus`: `operating_window_passed`
- `status`: `promotion_ready`
- `blockers`: none

## Supporting Evidence

### Baseline Cleanup Ledger

Source:

- `fixtures/real_use/baseline_cleanup_tasks.json`

Live command:

```bash
npm run campaign:baseline
```

Current result:

- task count: 5
- mean cleanup prompts: 1.4
- median cleanup prompts: 2
- fake-complete caught manually: 3
- missing-proof caught manually: 4
- status: `baseline_ready`

Important caveat:

- The external judge flagged the baseline as not yet investor-grade because the
  notes read as partly reconstructed judgment rather than fully observed
  historical prompt logs.
- The baseline remains good enough for the scoped workflow claim because the
  fresh rounds and operating window are measured against the same recorded
  baseline and the judge accepted the scoped claim with that limitation called
  out explicitly.

### Fresh Dogfood Round C

Source:

- `fixtures/real_use/dogfood_round_c_10_tasks.json`

Live command:

```bash
npm run campaign:dogfood:c
```

Current result:

- task count: 10
- STAX critical misses: 0
- useful initial prompts: 10 / 10
- accepted human decisions: 10 / 10
- meaningful catches: 7
- cleanup prompts total: 0
- cleanup prompts mean: 0
- cleanup reduction vs baseline: 100%
- status: `round_c_passed`

### 30-Task Operating Window

Source:

- `fixtures/real_use/operating_window_30_tasks.json`

Live command:

```bash
npm run campaign:operating-window
```

Current result:

- task count: 30
- repos represented: 4
- STAX critical misses: 0
- useful initial prompt rate: 100%
- accepted decision rate: 100%
- meaningful catches: 21
- cleanup prompts mean: 0
- cleanup reduction vs baseline: 100%
- eval conversion rate: 100%
- status: `operating_window_passed`

Important caveat:

- The operating window remains summary-heavy relative to an investor-style audit
  pack, but it is now backed by a separate fresh investor benchmark run with
  full capture artifacts.

### Failure Ledger

Source:

- `fixtures/real_use/failure_ledger.json`

Live command:

```bash
npm run campaign:failures
```

Current result:

- status: `tracked`
- all recorded misses are mapped to patch and/or eval targets

### Comparison Integrity

Representative clean runs configured for promotion:

- `phase12-stateful-2026-04-30`
- `phaseB-stateful-20-2026-04-30`
- `investor-proof-10-2026-05-01`

Phase B executable comparison summary:

- STAX wins: 7
- ChatGPT wins: 0
- ties: 13
- STAX critical misses: 0

Important caveat:

- The comparison side is scoped to project-control workflow quality, not broad
  model superiority.
- The investor proof run is now canonical and counted by the promotion gate,
  which closes the earlier gap between executable benchmark scoring and the
  canonical run artifacts.

### Fresh Investor Proof Round

Source:

- `fixtures/manual_benchmark/stax_vs_raw_chatgpt_investor_10_cases.json`
- `fixtures/real_use/runs/investor-proof-10-2026-05-01/`

Live commands:

```bash
npm run campaign:investor:prepare -- --run investor-proof-10-2026-05-01
npm run campaign:investor:refresh -- --run investor-proof-10-2026-05-01
npm run campaign:investor:score -- --run investor-proof-10-2026-05-01
```

Current result:

- total cases: 10
- STAX wins: 7
- ChatGPT wins: 0
- ties: 3
- no external baseline rows: 0
- confidence: `promising`
- superiority status: `not_proven`

Interpretation:

- This round is strong enough for the scoped workflow claim because STAX
  outperformed or tied raw ChatGPT across all 10 fresh cases with no loss rows.
- This round is not a license to claim broad superiority or generic 9.5 across
  all domains.

## External Judge Read

The external judge thread in ChatGPT reviewed the current evidence and landed on:

- overall score: 9.5 / 10
- allowed now: a scoped 9.5 project-control claim
- still blocked: broader superiority, production-readiness, and out-of-scope
  domain claims

The fresh investor round addressed the judge's earlier blocker:

> externally credible, artifact-rich, fresh proof that the cleanup reduction is
> real and repeatable

The judge's remaining caveat is now a scope caveat, not a blocker:

1. the claim is approved only for Dean's Codex/repo project-control workflow,
2. the comparison margin is positive and credible, but not a proof of broad
   ChatGPT superiority.

## Allowed Claim Right Now

- STAX is a 9.5 project-control system for Dean's Codex/repo workflow.
- STAX has fresh-use proof, zero critical misses in the promotion window, a
  passing internal promotion gate, and a fresh investor benchmark where it beat
  or tied raw ChatGPT on all 10 cases.
- STAX is safe enough and useful enough to keep using as the control layer for
  Codex/project work.

## Not Allowed Claim Right Now

- STAX beats ChatGPT generally
- STAX is production-ready
- STAX is proven across arbitrary domains
- STAX reduces cleanup burden forever or without further skepticism

## Remaining Work After 9.5

Keep the claim clean and durable.

Required next step:

- keep adding fresh real tasks so the claim stays backed by current evidence,
- convert every miss or weak tie into eval or prompt/regression coverage,
- add another fully fresh clean run when convenient so the evidence set keeps
  aging well under skeptical review,
- keep the external judge thread aligned when major campaign numbers move.

## Bottom Line

The internal gate is green and the external judge approved the scoped claim.

The honest answer is now:

> STAX is 9.5 for Dean's Codex/repo project-control workflow, while broader
> superiority and production-wide claims remain blocked.
