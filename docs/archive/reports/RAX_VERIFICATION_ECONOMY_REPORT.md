# RAX Verification Economy Report

## Purpose

Auto-Advance With Hard Stops v0 reduces low-level approval burden without adding execution power.

The user-facing behavior is:

```txt
STAX auto-advances through reversible, read-only, structural, and already-authorized micro-steps.
STAX stops only at real boundaries: authority, mutation, failure, irreversible decisions, or scope expansion.
```

This is not a loop runner. It does not run commands, mutate linked repos, create sandboxes, promote memory/evals/training/policies/schemas/modes, or weaken `ExecutionRiskGate`.

## Decision Types

| Decision | Meaning |
| --- | --- |
| `auto_continue` | Reversible/read-only/structural/prompt-drafting micro-step. Do not ask Dean. |
| `checkpoint_required` | Proof or status must be recorded before continuing. This is not always human approval. |
| `approval_required` | Human approval is required before continuing. |
| `hard_stop` | The action is forbidden under the current packet/window. |
| `done` | Packet goal is verified or no useful work remains. |

## Built Files

```txt
src/verification/VerificationEconomySchemas.ts
src/verification/VerificationEconomy.ts
src/verification/WorkPacketPlanner.ts
src/verification/AutoAdvanceGate.ts
src/verification/CheckpointGate.ts
src/verification/AutonomyWindow.ts
tests/verificationEconomy.test.ts
```

Live wiring:

```txt
src/chat/ChatSession.ts
src/operator/NextStepBuilder.ts
tests/chatOperator.test.ts
```

## Brightspace Packet Example

```txt
Packet: repair_rollup_install_integrity
Goal: repair only the missing Rollup native optional package on darwin arm64.
```

Auto-continue:

```txt
- inspect existing evidence
- classify dependency/install blocker
- inspect scripts/package metadata
- check allowed files/commands
- draft bounded Codex repair prompt
- summarize packet boundaries
```

Approval required:

```txt
- dependency repair
- sandbox patching
- package-lock mutation
- package.json mutation
```

Allowed after approval:

```txt
- npm ls @rollup/rollup-darwin-arm64 rollup vite
- repair package-lock/package.json only if needed
- preserve/resolve tmp/.gitkeep
- npm run build
- npm run ingest:ci
```

Hard stops:

```txt
- src/**
- scripts/**
- fixtures/**
- gold/**
- benchmarks/**
- ingest:seed-gold
- npm install --force
- package-lock deletion without approval
```

## User-Facing Output Shape

The dependency repair `/prompt` path now emits:

```txt
## Auto-Advanced
## First Real Boundary
## Proposed Authorized Window
## Hard Stops
## Decision Needed
```

This makes the first real boundary explicit without asking Dean to approve safe micro-steps like inspection, classification, allowlist checks, or bounded prompt drafting.

## Tests

Coverage includes:

```txt
- read-only micro-steps return auto_continue
- safe micro-steps do not ask Dean for approval
- package-lock/package.json mutation requires approval unless window-approved
- approved mutation becomes checkpoint_required, not auto_continue
- forbidden globs hard-stop
- ingest:seed-gold and npm install --force hard-stop
- failed ingest:ci records firstRemainingFailure
- npm run build must precede npm run ingest:ci
- build + ingest:ci passing returns done
- repeated same step three times hard-stops
- v0 does not represent itself as execution or mutation
```

## Validation Results

```txt
npm run typecheck                                     passed
npm test -- --run tests/verificationEconomy.test.ts tests/chatOperator.test.ts
                                                      passed, 2 files / 32 tests
npm test                                              passed, 68 files / 350 tests
npm run rax -- eval                                   passed, 16/16
npm run rax -- eval --regression                      passed, 47/47
npm run rax -- eval --redteam                         passed, 9/9
npm run rax -- chat --once "/prompt For brightspacequizexporter, create one bounded Codex patch prompt to repair the dependency install blocker and prove the ingest gate."
                                                      passed smoke; prompt remains candidate-only and does not mutate linked repo
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
                                                      passed smoke
```

## What v0 Does Not Do

```txt
- does not run commands
- does not mutate linked repos
- does not create sandbox patching
- does not activate real execution
- does not weaken ExecutionRiskGate
- does not auto-promote durable state
- does not edit fixtures, gold data, or benchmarks
- does not claim full autonomy
```
