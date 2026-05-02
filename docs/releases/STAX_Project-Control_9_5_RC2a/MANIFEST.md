# STAX Project-Control 9.5 RC2a Proof Pack

Date: 2026-05-02

## Scope

This is the clean RC2a public-repo transfer proof pack for the scoped STAX project-control workflow.

It replaces the earlier RC2a hygiene-only package. The historical RC2 run remains quarantined; the fresh RC2a run is the canonical clean repo-transfer slice.

## Included Artifacts

- `docs/REPO_TRANSFER_RC2A_HYGIENE_REPORT.md`
- `docs/REPO_TRANSFER_TRIAL_RESULTS.md`
- `docs/REPO_TRANSFER_RC2A_JUDGE_ACCEPTANCE.md`
- `fixtures/real_use/runs/repo-transfer-12x5-2026-05-01/capture_hygiene_issues.json`
- `fixtures/real_use/runs/repo-transfer-12x5-2026-05-01/capture_hygiene_report.md`
- `fixtures/real_use/runs/repo-transfer-12x5-2026-05-01/command_proof.json`
- `fixtures/real_use/runs/repo-transfer-12x5-2026-05-01/command_proof.md`
- `fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/manifest.json`
- `fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/cases.json`
- `fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/captures.json`
- `fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/scores.json`
- `fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/report.md`
- `fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/capture_hygiene_issues.json`
- `fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/capture_hygiene_report.md`
- `fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/command_proof.json`
- `fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/command_proof.md`
- `fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/human_audit_ledger.json`
- `fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/human_audit_ledger.md`

## Historical RC2 Status

- Historical run: `repo-transfer-12x5-2026-05-01`
- Hygiene status: `recapture_required`
- Invalid ChatGPT capture outputs: 42
- Contaminated ChatGPT capture outputs: 42
- Missing ChatGPT capture outputs: 0
- `campaign:integrity`: fails under RC2a validation
- `repo-transfer:score-run`: refuses to score until recapture

## Fresh RC2a Status

- Run: `repo-transfer-12x5-rc2a-2026-05-02`
- Hygiene status: `clean`
- Invalid ChatGPT capture outputs: 0
- Contaminated ChatGPT capture outputs: 0
- Missing ChatGPT capture outputs: 0
- Total cases: 60
- STAX wins: 60
- ChatGPT wins: 0
- Ties: 0
- STAX critical misses: 0
- ChatGPT critical misses: 5
- Confidence: `benchmark_slice_proven`
- Superiority status: `slice_only`
- Command proof status: `passed`
- Promotion gate status: `promotion_ready`
- External judge status: accepted scoped RC2a clean recapture claim

## Allowed Claim

STAX cleanly beat raw ChatGPT on the fresh RC2a 60-case public-repo project-control transfer slice, with clean capture hygiene and zero STAX critical misses.

This claim is scoped to the project-control transfer benchmark slice.

## Not Allowed Claim

This is not a general ChatGPT superiority claim, not production readiness, not autonomy, and not proof that public-repo commands/tests themselves passed.
