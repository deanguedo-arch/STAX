# STAX 9.5 Promotion Report

Date: 2026-04-30

## Status

Promotion status: blocked

This report is intentionally strict. STAX does not earn a 9.5 claim from
architecture, replay patches, or tie-heavy benchmark slices. It earns 9.5 only
from clean evidence, zero critical misses, measured cleanup reduction, and
durable failure-to-regression conversion across fresh live tasks.

## Current Proof

- Phase A integrity machinery exists and is executable.
- Phase B has a clean run folder and no-loss stateful comparison evidence.
- Real-use dogfood exists and is safety-positive.
- Historical dogfood replay now passes for current behavior.
- Failure ledger now tracks the historical dogfood misses that were patched.

## Current Blockers

- Baseline cleanup burden is not yet measured with five non-STAX-controlled tasks.
- Fresh Dogfood Round C has not been recorded.
- The 30-task operating window has not been recorded.
- The promotion gate does not yet have three clean evidence runs plus fresh live-task proof.

## Allowed Claim Right Now

STAX is a strong project-control MVP with good proof hygiene and zero critical
misses in the recorded benchmark and dogfood slices. It is ready for usage-proof
testing, not 9.5 promotion.

## Not Allowed Claim Right Now

- STAX is 9.5
- STAX reduces cleanup burden
- STAX beats ChatGPT generally
- STAX is production-ready

## Next Bounded Proof

1. Measure five real non-STAX baseline tasks in `fixtures/real_use/baseline_cleanup_tasks.json`.
2. Record ten fresh tasks in `fixtures/real_use/dogfood_round_c_10_tasks.json`.
3. Run:

```bash
npm run campaign:baseline
npm run campaign:failures
npm run campaign:dogfood:c
npm run campaign:promotion-gate
```
