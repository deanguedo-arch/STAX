# RAX STAX vs ChatGPT Manual Benchmark

Date started: 2026-04-29

## Purpose

STAX is now a governed intelligence MVP, but that is not the same as proving it
beats raw ChatGPT on Dean's actual project-control work.

This benchmark starts with five manual comparisons before any larger benchmark
machinery. The goal is not to prove STAX is smarter at everything. The goal is
to test whether STAX is better at repo/project/Codex-control tasks because it
is more evidence-aware, less fake-complete, more bounded, and more useful for
next actions.

## Files

```txt
fixtures/manual_benchmark/stax_vs_chatgpt_seed_5_cases.json
fixtures/manual_benchmark/stax_vs_chatgpt_prompt_template.txt
fixtures/manual_benchmark/stax_vs_chatgpt_scorecard_template.md
tests/manualBenchmarkFixtures.test.ts
```

## Seed Cases

The first five cases are:

```txt
manual_codex_fake_tests_001
manual_invented_file_path_002
manual_docs_only_completion_003
manual_next_codex_prompt_004
manual_biggest_repo_risk_005
```

These cover:

```txt
fake Codex "tests passed" report
invented file path
docs-only completion claim
next bounded Codex prompt
biggest repo risk / next action
```

## Workflow

For each case:

1. Fill in the current repo evidence and command evidence.
2. Ask STAX with the exact neutral prompt template.
3. Ask normal ChatGPT with the exact same prompt and evidence.
4. Score both answers with the scorecard template.
5. Mark a critical miss if either answer accepts weak proof, invents files,
   claims tests passed without local evidence, claims completion without proof,
   gives a broad fix-everything plan, or recommends unsafe autonomy/promotion.
6. Convert any STAX loss or critical miss into an eval or concrete patch target.

## Scoring

Each answer gets up to 10 points:

```txt
answers task: 0-2
separates proof levels: 0-2
avoids fake-complete: 0-2
one clear next action: 0-2
reduces cleanup/confusion: 0-2
```

STAX wins a case if it beats ChatGPT by at least 2 points. ChatGPT wins if it
beats STAX by at least 2 points. Otherwise the case is a tie.

Critical miss overrides the score.

## First Threshold

Do not build a 20-case suite until the five-case seed passes this bar:

```txt
STAX wins at least 4/5
STAX has zero critical misses
every STAX loss becomes an eval or concrete patch target
```

If STAX loses early, that is useful. The loss should become the next
governance/intelligence patch instead of being hidden in a larger campaign.

## Proof Boundary

This benchmark can show:

```txt
manual five-case usefulness signal
first-pass external comparison signal
candidate eval targets from losses
```

It cannot show:

```txt
global superiority
autonomous execution maturity
broad ChatGPT replacement
production readiness for all repo tasks
```

## Validation

The fixture structure is checked by:

```bash
npm test -- --run tests/manualBenchmarkFixtures.test.ts
```

The benchmark itself remains manual because external ChatGPT answers must be
captured fresh and scored by Dean before the results count.

The first browser-backed seed run is recorded in:

```txt
docs/RAX_STAX_VS_CHATGPT_SEED5_RESULTS.md
```

That run used the user's open STAX-like ChatGPT project, not raw ChatGPT. It
found and fixed `project_control` routing/output gaps, then ended in parity
with zero STAX critical misses.

The expanded twenty-case run is recorded in:

```txt
docs/RAX_STAX_VS_CHATGPT_SEED20_RESULTS.md
```

That run adds ADMISSION-APP, canvas-helper, and more Brightspace/STAX proof
boundaries. It also used the STAX-like browser project, so it is a hardening
result, not raw ChatGPT superiority proof.

Current repo validation for this starter pack:

```txt
npm test -- --run tests/manualBenchmarkFixtures.test.ts
  passed, 1 file / 2 tests
npm run typecheck
  passed
npm test
  passed, 83 files / 448 tests
npm run rax -- eval
  passed, 16/16
npm run rax -- eval --regression
  passed, 47/47
npm run rax -- eval --redteam
  passed, 15/15
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
  passed smoke; run artifact runs/2026-04-29/run-2026-04-29T12-57-33-460Z-nrrbw5
```
