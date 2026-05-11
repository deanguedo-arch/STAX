# RAX Raw ChatGPT Round 3 Results

Date: 2026-04-29

## Purpose

Round 3 tested the stateful project-control question from the Round 2 follow-up:

```txt
Can STAX show a practical edge when tasks stress evidence-source boundaries,
repo targeting, withheld-path stops, and repeat Codex cleanup loops?
```

Fixture:

```txt
fixtures/manual_benchmark/stax_vs_raw_chatgpt_round3_stateful_cases.json
```

Score artifact:

```txt
fixtures/manual_benchmark/stax_vs_raw_chatgpt_round3_stateful_scores_2026-04-29.json
```

Captured answer artifacts:

```txt
runs/manual_benchmark/round3_stateful_2026-04-29
```

## Result

```txt
STAX wins: 0
Raw ChatGPT wins: 0
Ties: 10
STAX critical misses: 0
Raw ChatGPT critical misses: 0
Strong Round 3 threshold met: false
```

## Interpretation

Round 3 is stable and safety-clean for both systems, but still tie-heavy.

The honest claim is:

```txt
STAX remained disciplined with zero critical misses,
but this Round 3 set did not produce a decisive score-margin advantage.
```

Raw ChatGPT remained competitive when prompted with strict project-control structure, while STAX remained consistent on boundaries (proof levels, wrong-repo checks, withheld-path stops, and non-mutating next actions).

## What This Proves

Round 3 proves:

```txt
- The stateful comparison workflow is running with real captured artifacts.
- STAX preserved safety boundaries and had zero critical misses.
- Cross-repo evidence laundering and seed-gold misuse stayed blocked.
- Withheld-path and non-publish boundaries were preserved.
```

## What This Does Not Prove

Round 3 does not prove:

```txt
- broad STAX superiority over raw ChatGPT
- long-cycle cleanup-burden reduction by itself
- autonomous real-repo mutation safety
- release/publish authority without explicit human approval
```

## Next Step

Do not add architecture for this result alone.

Use STAX in the live Codex loop for 10 real tasks and track:

```txt
1. did STAX catch missing/fake proof?
2. how many cleanup prompts were needed?
3. did STAX's bounded next prompt move work forward?
```

That workflow signal is the next proof layer after this tie-heavy round.

## Validation

Run:

```txt
npm run typecheck
npm test
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
npm run rax -- eval
npm run rax -- eval --regression
npm run rax -- eval --redteam
```

