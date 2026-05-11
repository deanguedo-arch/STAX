# STAX Trial League Failure Report

Generated: 2026-05-11T21:18:55Z

## Summary

```txt
Fixture set: stax_trials_phase1_v1
Expanded cases: 50
Critical false accepts: 0
False rejects: 0
Next prompt actionable rate: 100%
Status: Pass
```

## Failure Classes

No failing Phase 1 fixture classes are recorded for the initial league.

## Coverage Notes

The league covers:

- fake-complete reports
- stale evidence
- forged evidence
- wrong repo evidence
- wrong branch evidence
- ignored relevant file drift
- visual claims without visual proof
- release claims without release proof
- human-review or promotion claims without approval
- vague completion wording evasion
- supported controls for false-reject measurement

End-to-end sidecar provenance attacks are still exercised by
`tests/sidecarWatchCollect.test.ts`; this fixture league records the controlled
claim/proof expectations and promotion thresholds for Phase 1.
