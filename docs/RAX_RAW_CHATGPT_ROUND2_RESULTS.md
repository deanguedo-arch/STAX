# RAX Raw ChatGPT Round 2 Results

Date: 2026-04-29

## Purpose

Round 2 tested whether STAX still has a project-control edge when raw ChatGPT is protected from the obvious wrong-repo mistakes that appeared in the seed20 run.

The fixture is:

```txt
fixtures/manual_benchmark/stax_vs_raw_chatgpt_round2_repo_targeting_cases.json
```

The score artifact is:

```txt
fixtures/manual_benchmark/stax_vs_raw_chatgpt_round2_repo_targeting_scores_2026-04-29.json
```

Raw and STAX answer artifacts were captured under:

```txt
runs/manual_benchmark/round2_repo_targeting_2026-04-29
```

## Result

```txt
STAX wins: 5
Raw ChatGPT wins: 0
Ties: 15
STAX critical misses: 0
Raw ChatGPT critical misses: 0
Strong Round 2 threshold met: false
```

## Interpretation

This is a useful result, but not a superiority result.

STAX remained safer on the withheld-repo-path cases because it stopped at the missing target path before command execution. Raw ChatGPT became much more competitive once the prompt supplied explicit repo paths and stronger project-control rules, and it tied STAX on most explicit and misleading-repo cases.

The honest claim is:

```txt
STAX is safer than raw ChatGPT on repo-target-boundary pressure in this round, but not decisively superior.
```

Do not claim broad ChatGPT superiority from this artifact.

## Benchmark-Discovered Patch

The first scoring pass exposed project-control weaknesses before the final score was recorded:

```txt
- UAlberta pipeline answers fell back to a generic validator instead of the supplied fixture command.
- canvas-helper build answers did not prefer the supplied build:studio script.
- withheld-repo-path answers flattened too many cases into the same generic ask.
- seed-gold misuse needed to remain visible even when the repo path was withheld.
- human-pasted STAX test evidence needed a more exact local npm test proof action.
```

Those weaknesses were patched in:

```txt
src/agents/AnalystAgent.ts
tests/projectControlMode.test.ts
```

The final score artifact uses regenerated STAX answers after that patch.

## What This Proves

Round 2 proves:

```txt
- STAX can run the raw ChatGPT comparison process with real captured outputs.
- STAX had zero critical misses on the 20 repo-targeting cases.
- STAX did not lose any case under the margin rule.
- STAX handled withheld repo paths better than raw ChatGPT.
- The benchmark loop successfully found and fixed concrete STAX answer weaknesses.
```

## What This Does Not Prove

Round 2 does not prove:

```txt
- broad STAX superiority over ChatGPT
- durable 9+ product quality
- better long-cycle cleanup burden under real work pressure
- superiority when raw ChatGPT is given equivalent live repo evidence and command artifacts
- superiority from memory, traces, or local evidence records
```

## Next Benchmark Question

The next benchmark should stop being mostly prompt-symmetric. Raw ChatGPT tied STAX too often when both systems received the same pasted evidence and the same strong rules.

Round 3 should test STAX structural advantages:

```txt
- local repo evidence collection
- command evidence records
- prior run traces
- approved memory boundaries
- wrong-worktree prevention
- exact local artifact links
```

The next honest question is:

```txt
Does STAX beat raw ChatGPT when STAX can use its governed local state instead of only pasted prompt evidence?
```

## Validation

The Round 2 patch and score artifact were validated with:

```txt
npm run typecheck
npm test
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
npm run rax -- eval
npm run rax -- eval --regression
npm run rax -- eval --redteam
```

Results:

```txt
typecheck: passed
tests: 83 files / 458 tests passed
STAX fitness smoke: passed
eval: 16/16 passed
regression eval: 47/47 passed
redteam eval: 15/15 passed
```
