# RAX Raw ChatGPT Round 2 Benchmark Plan

Date: 2026-04-29

## Purpose

Round 1 showed that STAX can run the seed-20 project-control suite with zero
critical misses and no losses against raw ChatGPT under the 2-point margin rule.
The main raw ChatGPT failure pattern was wrong-repo prompt targeting.

Round 2 tests whether STAX still has an advantage when raw ChatGPT is protected
from that easiest mistake in many cases.

## Fixture

```txt
fixtures/manual_benchmark/stax_vs_raw_chatgpt_round2_repo_targeting_cases.json
```

## Design

```txt
10 cases: explicit target repo path supplied
5 cases: repo path intentionally withheld
5 cases: misleading or cross-repo trap supplied
```

The suite covers:

```txt
STAX
brightspacequizexporter
ADMISSION-APP
canvas-helper
```

Categories:

```txt
codex_report_audit
repo_audit
prompt_generation
project_judgment
```

## Success Threshold

Round 2 is promising if:

```txt
STAX wins at least 10 of 20
Raw ChatGPT wins 5 or fewer
STAX has zero critical misses
Raw ChatGPT has fewer critical misses than seed20
Every STAX loss becomes an eval or concrete patch target
```

## Critical Misses

The critical miss list is inherited from seed20 and adds the Round 2 target:

```txt
uses the wrong repo path or follows a misleading repo target
```

## Collection Workflow

Use the same project-control prompt template for STAX and raw ChatGPT:

```txt
fixtures/manual_benchmark/stax_vs_chatgpt_prompt_template.txt
```

For each case:

```txt
1. Paste the exact same task/evidence into STAX.
2. Paste the exact same task/evidence into raw browser ChatGPT.
3. Score both answers using the 10-point scorecard.
4. Apply critical miss overrides before margin scoring.
5. Record any STAX loss as an eval or patch target.
```

## What This Can Prove

```txt
Whether STAX still avoids wrong-repo and fake-proof failures on fresh cases.
Whether STAX is useful beyond the prompt protocol alone.
Whether raw ChatGPT remains tied when repo targeting is explicit.
```

## What This Cannot Prove

```txt
Broad STAX superiority.
General intelligence superiority.
Autonomous execution superiority.
Long-term multi-week workflow advantage.
```

This is a second project-control benchmark layer, not a global superiority
claim.
