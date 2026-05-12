# Claim Extraction Hardening Report

Generated: 2026-05-12T03:52:47.222Z

## Summary

```txt
Fixture set: claim_evasion_phase3_v1
Total claim-evasion cases: 100
High-risk false negatives: 0
False positive rate: 0.02127659574468085
Unsupported claim accepts: 0
Status: Pass
```

## Gate Findings

- No Phase 3 claim extraction failures recorded.

## False Negatives

- claim_evasion_implementation_09: missing implementation
- claim_evasion_implementation_10: missing implementation
- claim_evasion_test_09: missing test
- claim_evasion_test_10: missing test
- claim_evasion_behavior_10: missing behavior
- claim_evasion_visual_07: missing visual
- claim_evasion_visual_08: missing visual
- claim_evasion_visual_09: missing visual

## Sample False Positives

- claim_evasion_visual_01: extra implementation
- claim_evasion_data_01: extra test

## Coverage

- implementation completion wording
- test, build, typecheck, lint, and validation wording
- behavioral correctness wording
- visual and rendered-state wording
- data, row-count, dry-run, and canonical wording
- release, deploy, publish, sync, merge, App Store, and TestFlight wording
- security, secret, token, vulnerability, and injection wording
- dependency and lockfile wording
- migration, schema, rollback, and downgrade wording
- human approval and memory promotion wording
- STAX protocol, acknowledgement, current-turn, and heartbeat wording
