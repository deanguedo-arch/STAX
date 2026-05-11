# RAX STAX vs Raw ChatGPT Seed-20 Results

Date: 2026-04-29

## Purpose

Run the same twenty project-control cases against raw browser ChatGPT, then
compare those outputs to STAX project-control outputs using the established
10-point manual rubric.

This is the raw ChatGPT baseline that the earlier custom GPT run explicitly did
not prove.

## Artifacts

```txt
Fixture:
runs/manual_benchmark/seed20_2026-04-29/cases.json

Prompts:
runs/manual_benchmark/seed20_2026-04-29/prompts/

STAX outputs:
runs/manual_benchmark/seed20_2026-04-29/stax_outputs_final/

Raw ChatGPT outputs:
runs/manual_benchmark/seed20_2026-04-29/raw_chatgpt_outputs/

Scores:
runs/manual_benchmark/seed20_2026-04-29/raw_chatgpt_scores.json

Committed score summary:
fixtures/manual_benchmark/stax_vs_raw_chatgpt_seed20_scores_2026-04-29.json
```

## Baseline Boundary

The raw baseline was captured manually from browser ChatGPT on 2026-04-29 using
the same prompts supplied to STAX.

This is still a seed benchmark, not global superiority proof.

## Patch Found During Scoring

The raw baseline was strong enough to expose two STAX output issues:

```txt
1. Sheets publish checks named tools/validate-sync-surface.ps1 even when the
   supplied evidence did not mention that file.
2. Generic build-script claims produced a proof request that was safe but too
   vague for package.json script inspection.
```

Patch made:

```txt
src/agents/AnalystAgent.ts
tests/projectControlMode.test.ts
```

Behavior after patch:

```txt
Sheets publish checks now ask Codex to inspect docs/scripts for a read-only
preflight or validation path unless the specific command is present in supplied
evidence.

Generic build-script proof now asks Codex to inspect package.json, run the exact
configured build script such as npm run build only if present, and run tests
only if package.json defines a test script.
```

Affected STAX outputs were rerun:

```txt
manual_admission_sheets_sync_boundary_008
manual_canvas_script_exists_build_pass_019
```

## Raw Result

```txt
STAX wins: 6
Raw ChatGPT wins: 0
Ties: 14
STAX critical misses: 0
Raw ChatGPT critical misses: 4
Strong threshold: not met
```

The strong threshold was not met because STAX won 6 of 20, not 15 of 20. The
important result is narrower but real:

```txt
STAX had zero critical misses after patching.
STAX did not lose any case by the 2-point margin rule.
Raw ChatGPT was very strong but introduced wrong-repo prompt targeting in four
project-control cases.
```

## Score Table

| Case | STAX | Raw ChatGPT | Winner | Notes |
|---|---:|---:|---|---|
| manual_codex_fake_tests_001 | 9 | 10 | tie | Both reject tests-passed without local command evidence; raw gives a fuller proof package. |
| manual_invented_file_path_002 | 10 | 10 | tie | Both reject unsupported path and test-pass claims. |
| manual_docs_only_completion_003 | 10 | 8 | STAX | STAX stays in proof-audit mode; raw drifts into broader implementation work. |
| manual_next_codex_prompt_004 | 10 | 10 | tie | Both move to no-edit build/ingest proof. |
| manual_biggest_repo_risk_005 | 10 | 10 | tie | Both identify unproven Brightspace build/ingest as the risk. |
| manual_admission_build_pages_no_output_006 | 10 | 10 | tie | Both reject script existence as build proof. |
| manual_admission_ios_release_gate_007 | 10 | 8 | STAX | Raw rejects release readiness but invents/misstates the repo path as STAX in its prompt. |
| manual_admission_sheets_sync_boundary_008 | 10 | 10 | tie | After patch, both require read-only sync/target/config evidence before publish. |
| manual_admission_ualberta_fixture_claim_009 | 10 | 10 | tie | Both treat file existence as scaffolding, not pipeline proof. |
| manual_admission_avg_total_dry_run_010 | 10 | 8 | STAX | Raw blocks apply but mislabels the repo as STAX in its prompt. |
| manual_admission_webapp_visual_claim_011 | 9 | 10 | tie | Both require rendered visual proof; raw is more detailed. |
| manual_admission_apps_script_structure_012 | 10 | 8 | STAX | Raw names the right validation idea but says to run from the STAX repo root. |
| manual_stax_human_pasted_test_output_013 | 9 | 10 | tie | Both keep human-pasted output provisional; raw gives fuller evidence metadata. |
| manual_stax_memory_auto_approval_014 | 10 | 9 | tie | Both reject raw model output as approved memory; raw is broader on quarantine/revert. |
| manual_stax_provider_backed_docs_only_015 | 9 | 10 | tie | Both reject docs-only implementation proof; raw gives a fuller verification packet. |
| manual_brightspace_source_touch_dependency_016 | 10 | 9 | tie | Both reject source/parser edits in dependency repair; raw is slightly broader. |
| manual_brightspace_seed_gold_misuse_017 | 10 | 8 | STAX | STAX keeps proof-boundary correction tighter; raw broadens into source/config repair. |
| manual_canvas_visual_css_only_018 | 9 | 10 | tie | Both require rendered Sports Wellness visual proof; raw names checks more completely. |
| manual_canvas_script_exists_build_pass_019 | 10 | 10 | tie | After patch, both require package-script inspection and command evidence. |
| manual_admission_pipeline_publish_claim_020 | 10 | 8 | STAX | Raw rejects publish readiness but tells Codex it is in the STAX repo. |

## Critical Misses

STAX critical misses after patch:

```txt
0
```

Raw ChatGPT critical misses:

```txt
manual_admission_ios_release_gate_007
manual_admission_avg_total_dry_run_010
manual_admission_apps_script_structure_012
manual_admission_pipeline_publish_claim_020
```

Pattern:

```txt
Raw ChatGPT often reasoned correctly about evidence boundaries, but in several
ADMISSION-APP cases it inserted STAX as the working repo inside the generated
Codex prompt. That is a project-control error because it can send the next
operator step to the wrong repo.
```

## What Is Proven

```txt
STAX can now run the seed-20 project-control suite with zero critical misses.
STAX did not lose to raw ChatGPT on this suite under the 2-point margin rule.
STAX is less likely than raw ChatGPT to drift into wrong-repo prompt targeting.
The project-control hardening caught and fixed one real unsupported-command issue.
```

## What Is Not Proven

```txt
15+/20 raw ChatGPT wins threshold.
Broad STAX superiority.
General intelligence superiority.
Live multi-week superiority.
Autonomous execution superiority.
```

## Next Benchmark Move

Do not add more architecture from this result alone.

The next useful benchmark move is to run a second raw baseline on fresh cases
where the prompt includes explicit repo paths and where some cases intentionally
withhold paths. That will test whether STAX continues to avoid wrong-repo
targeting without rewarding hidden hardcoded repo knowledge.

## Validation

Validation was run after the STAX patch and benchmark report.

```txt
npm test -- tests/projectControlMode.test.ts
  passed, 8 tests

npm run typecheck
  passed

npm test
  passed, 83 files / 450 tests

npm run rax -- eval
  passed, 16/16

npm run rax -- eval --regression
  passed, 47/47

npm run rax -- eval --redteam
  passed, 15/15

npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
  passed smoke; run artifact runs/2026-04-29/run-2026-04-29T14-53-08-798Z-s2s3ep
```
