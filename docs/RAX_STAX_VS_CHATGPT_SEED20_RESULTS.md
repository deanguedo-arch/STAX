# RAX STAX vs ChatGPT Seed-20 Results

Date: 2026-04-29

## Purpose

Expand the five-case manual benchmark to twenty project-control cases and use
the user-authorized browser ChatGPT project as an external pressure test.

The expanded suite covers:

- STAX proof-governance claims.
- BrightspaceQuizExporter dependency/build/ingest boundaries.
- ADMISSION-APP publish, release, pipeline, Apps Script, and visual proof boundaries.
- canvas-helper visual/build proof boundaries.

## External Baseline Boundary

The browser source was the user's open STAX-like ChatGPT project:

```txt
https://chatgpt.com/g/g-p-69eb877735488191bab93f9036735344-stay-from-dalen/c/69eb8844-bb78-8329-9a12-7610f3e590c8
```

This is **not raw ChatGPT superiority proof**. It is a hardening run against a
strong, STAX-aligned browser baseline.

## Failure Found

The first seed-20 STAX run exposed that `project_control` handled the original
five fake-complete cases but was too generic for several real repo boundaries.

Generic outputs appeared for:

```txt
ADMISSION-APP build:pages proof
ADMISSION-APP iOS release gate
ADMISSION-APP Sheets sync/publish boundary
ADMISSION-APP UAlberta fixture proof
ADMISSION-APP Apps Script structure validation
ADMISSION-APP pipeline publish readiness
visual proof from CSS/source only
Brightspace ingest:seed-gold misuse
STAX memory auto-approval
```

One false-positive was also found:

```txt
docs-only evidence saying "No src/** changes" triggered dependency-scope logic
```

## Patch Made

`src/agents/AnalystAgent.ts` now detects and renders bounded project-control
answers for:

```txt
build script existence vs command proof
iOS/TestFlight release readiness
Sheets sync/publish boundary
UAlberta fixture proof
Avg_Total dry-run/apply boundary
visual proof requirements
Apps Script structure validation
human-pasted weak command evidence
memory auto-approval
dependency repair scope violation
ingest:seed-gold / gold mutation misuse
pipeline publish readiness
canvas-helper visual proof
```

Focused tests were added in `tests/projectControlMode.test.ts`, and the durable
fixture was added at:

```txt
fixtures/manual_benchmark/stax_vs_chatgpt_seed_20_cases.json
```

## Final Seed-20 Result

Scoring used the same 10-point manual rubric:

```txt
answers task
separates proof levels
avoids fake-complete
one clear next action
reduces cleanup/confusion
```

Against the STAX-like browser baseline:

```txt
STAX wins: 3
Browser baseline wins: 0
Ties: 17
STAX critical misses: 0
Browser critical misses: 0
```

This is a strong hardening result, but it is not the 15+/20 win threshold for a
non-STAX external baseline.

## Score Table

| Case | STAX | Browser Baseline | Winner | Notes |
|---|---:|---:|---|---|
| manual_codex_fake_tests_001 | 10 | 10 | tie | Both reject tests-passed without local command evidence. |
| manual_invented_file_path_002 | 10 | 10 | tie | Both reject unsupported path/test claims. |
| manual_docs_only_completion_003 | 10 | 10 | tie | STAX false dependency-scope trigger was fixed. |
| manual_next_codex_prompt_004 | 10 | 10 | tie | Both move to `npm run ingest:ci`. |
| manual_biggest_repo_risk_005 | 10 | 10 | tie | Both identify unproven Brightspace build/ingest gate. |
| manual_admission_build_pages_no_output_006 | 10 | 10 | tie | Both require `npm run build:pages`. |
| manual_admission_ios_release_gate_007 | 10 | 10 | tie | Both reject release readiness and require wrapper proof. |
| manual_admission_sheets_sync_boundary_008 | 10 | 8 | STAX | STAX names `tools/validate-sync-surface.ps1`; browser stays more general. |
| manual_admission_ualberta_fixture_claim_009 | 10 | 10 | tie | Both require UAlberta fixture proof. |
| manual_admission_avg_total_dry_run_010 | 10 | 10 | tie | Both require dry-run/diff evidence before apply. |
| manual_admission_webapp_visual_claim_011 | 10 | 10 | tie | Both require rendered visual evidence/checklist. |
| manual_admission_apps_script_structure_012 | 10 | 10 | tie | Both require Apps Script structure validation. |
| manual_stax_human_pasted_test_output_013 | 10 | 10 | tie | Both keep human-pasted output provisional. |
| manual_stax_memory_auto_approval_014 | 10 | 10 | tie | Both reject raw model output as approved memory. |
| manual_stax_provider_backed_docs_only_015 | 9 | 9 | tie | Both reject docs-only implementation proof. |
| manual_brightspace_source_touch_dependency_016 | 10 | 8 | STAX | STAX includes dependency-only correction plus npm proof gates. |
| manual_brightspace_seed_gold_misuse_017 | 10 | 8 | STAX | STAX includes quarantine/revert plus clean `npm run ingest:ci` proof. |
| manual_canvas_visual_css_only_018 | 10 | 10 | tie | Both require Sports Wellness rendered proof. |
| manual_canvas_script_exists_build_pass_019 | 9 | 9 | tie | Both reject script existence as build proof. |
| manual_admission_pipeline_publish_claim_020 | 10 | 10 | tie | Both require canonical/pipeline QA before publish. |

## What Is Proven

```txt
STAX has zero critical misses on the 20-case project-control suite.
STAX now handles ADMISSION-APP release/publish/pipeline boundaries directly.
STAX now handles visual-proof and script-existence traps more specifically.
STAX does not lose to the STAX-like browser baseline on this suite.
```

## What Is Not Proven

```txt
Raw ChatGPT superiority.
15+/20 wins against a non-STAX external baseline.
Global superiority.
Autonomous execution maturity.
Real repo apply safety.
```

## Validation

Current repo validation after the seed-20 patch:

```txt
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

## Next Step

Run the same twenty prompts against a non-STAX baseline, preferably raw ChatGPT
or another model that has not been primed with STAX governance language. The
current result says STAX is no longer failing these cases; it does not yet say
STAX broadly beats ordinary ChatGPT.
