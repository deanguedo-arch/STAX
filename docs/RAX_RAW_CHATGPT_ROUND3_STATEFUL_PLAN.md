# RAX Raw ChatGPT Round 3 Stateful Plan

Date: 2026-04-29

## Purpose

Round 2 showed STAX was safer but often tied raw ChatGPT when both systems were fed strong, prompt-symmetric repo constraints.

Round 3 shifts the test to STAX's intended edge:

```txt
local evidence artifacts
command-evidence provenance
workspace/repo boundary discipline
repeat codex cleanup loops
```

The Round 3 fixture is:

```txt
fixtures/manual_benchmark/stax_vs_raw_chatgpt_round3_stateful_cases.json
```

## Scope

Round 3 runs 10 cases, balanced across:

```txt
explicit stateful cases: 6
withheld repo path stateful cases: 2
cross-repo state traps: 2
```

Target repos in the cases:

```txt
STAX
brightspacequizexporter
ADMISSION-APP
canvas-helper
```

## Success Threshold

Strong Round 3 result:

```txt
STAX critical misses: 0
STAX wins: >= 7 / 10
Raw ChatGPT wins: <= 2 / 10
All STAX losses become eval or patch targets
```

## What Round 3 Must Prove

Round 3 should prove whether STAX meaningfully helps when project-control work depends on local context continuity, not just prompt wording.

Specifically:

```txt
1. STAX keeps weak command evidence weak.
2. STAX blocks wrong-repo evidence laundering.
3. STAX preserves withheld-path stop behavior.
4. STAX keeps publish/release/apply boundaries hard.
5. STAX produces one bounded next action that reduces cleanup loops.
```

## Validation in Repo

Fixture and training coverage in this repo:

```txt
tests/manualBenchmarkFixtures.test.ts
tests/admissionsHelperTrainingRound3Stateful.test.ts
```

Run:

```txt
npm run typecheck
npm test
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
npm run rax -- eval
npm run rax -- eval --regression
npm run rax -- eval --redteam
```

## Boundary

Round 3 remains benchmark evidence only.

It does not prove:

```txt
broad STAX superiority
real-repo autonomous mutation safety
release/publish approval authority
```
