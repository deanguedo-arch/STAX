# Limited Hard Gate Rollback Proof

Generated for Phase 6 limited hard-gate planning.

## Current Status

Rollback proof is policy-level only until the Phase 4 soft-gate trial passes.
No protected hard gate should be enabled from this file alone.

## Required Rollback Proof Before Activation

- protected boundary selected
- command or CI job named
- owner named
- bypass or approval path documented
- rollback command documented
- rollback command classified by command-risk policy
- rollback dry run or fixture proof recorded

## Kill Switch

If hard gate creates unsafe operational friction, revert that boundary to soft
mode and record the reason in the trial report.

