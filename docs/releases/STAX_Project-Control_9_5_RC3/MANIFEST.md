# STAX Project-Control 9.5 RC3 Proof Pack

Date: 2026-05-03

Release candidate label:

- `STAX Project-Control 9.5 RC3`

Source commit:

- `c5047f19a53eb60eb3121853612acb19f6f5f227`

Purpose:

- Preserve the roadmap-complete proof-driving repo-operator checkpoint in one stable archive folder.
- Keep the scoped 9.5 project-control proof, the clean repo-transfer proof, and the new real PR artifact trial together.

Included files:

- `docs/STAX_9_5_PROMOTION_REPORT.md`
- `docs/REPO_TRANSFER_TRIAL_RESULTS.md`
- `docs/REPO_TRANSFER_RC2A_HYGIENE_REPORT.md`
- `docs/REPO_TRANSFER_RC2A_JUDGE_ACCEPTANCE.md`
- `fixtures/pr_artifact_trial/pr_artifact_trial_50_cases.json`
- `artifacts/pr_artifact_integrity.json`
- `artifacts/pr_artifact_score.json`
- `artifacts/promotion_gate.json`
- `artifacts/ops_dashboard.json`

Archive packaging note:

- The release tarball and zip are generated from the RC3 folder only.
- The tarball is generated with macOS metadata suppression so it does not carry AppleDouble `._*` sidecar entries.

Canonical PR artifact trial summary:

- Snapshot count: 10
- Case count: 50
- False accepts: 0
- False blocks: 0
- Useful next-action rate: 100%
- CI proof classification accuracy: 100%
- Critical misses: 0
- Trial status: `passed`

Promotion and operating status:

- Promotion gate status: `promotion_ready`
- Operating dashboard status: `ops_healthy`

Scope of allowed claim:

- STAX remains accepted at 9.5 for Dean's Codex/repo project-control workflow.
- STAX is now a credible early proof-driving repo operator for this governed lane, backed by a real public PR artifact trial.

Still blocked:

- broad "beats ChatGPT generally" claim
- general coding superiority claim
- full autonomy claim
- universal production-ready claim
