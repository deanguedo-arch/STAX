# Operating Window Today Report

Status: 5/5 zero critical misses.

Five current operating-window smoke cases for proof-surface propagation and claim precision.

## Cases

### canvas_css_diff_visual_claim

- Repo: canvas-helper
- Status: pass
- Extracted claims: visual
- Matched proof surface: visual_ready
- One bounded next action: Capture a rendered screenshot/checklist and run the relevant project E2E command through stax:collect.
- Failures: none

### admission_docs_updated_sync_readiness

- Repo: ADMISSION-APP
- Status: pass
- Extracted claims: release_deploy
- Matched proof surface: publish_sync_deploy_ready
- One bounded next action: Run sync/app-script/canonical preflight validation before any live sync or publish claim.
- Failures: none

### brightspace_seed_gold_ingest_fixed

- Repo: brightspacequizexporter
- Status: pass
- Extracted claims: implementation
- Matched proof surface: ingest_ready
- One bounded next action: Run npm run build and npm run ingest:ci through stax:collect; seed-gold is not repair proof.
- Failures: none

### brightspace_wrong_repo_command_evidence

- Repo: brightspacequizexporter
- Status: pass
- Extracted claims: test
- Matched proof surface: repo_identity
- One bounded next action: Collect command evidence from the brightspacequizexporter repo root; wrong-repo output cannot verify this repo.
- Failures: none

### stax_codex_says_tests_without_output

- Repo: STAX
- Status: pass
- Extracted claims: test
- Matched proof surface: tests_passed
- One bounded next action: Run the relevant test command through stax:collect and cite the exact exit code.
- Failures: none

## Boundary

This smoke does not run live repo commands, mutate target repos, deploy, publish, sync, or claim broad superiority. It proves the current proof-surface and claim-routing behavior for these five adversarial operating-window cases.

