# Limited Hard Gate Trial Report

Generated for Phase 6 limited hard-gate planning.

## Status

```txt
Status: passed
Command: npm test -- tests/sidecarProtocolPreflight.test.ts tests/cliProofGate.test.ts
Exit code: 0
Proof: 2 test files, 8 tests passed
```

## Trial Boundary

No hard-gate protected boundary has been activated by this artifact. The trial
proves the policy and CLI behavior only.

## Current Evidence

The repo has preflight mode machinery, boundary policy selection, soft bypass
events, hard protocol blocking, and CLI event recording tests. Limited hard gate
remains blocked by the rollout gate until prerequisite soft-gate evidence and
phase ordering are satisfied.
