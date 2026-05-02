# STAX Project-Control 9.5 RC2a Hygiene Pack

Date: 2026-05-02

## Scope

This is a proof-hygiene correction pack for the RC2 public-repo transfer run.

It does not claim a clean `60-0` result. It preserves the external judge finding that RC2 was over-scored/provisional and records the strengthened validation behavior that now blocks scoring until invalid ChatGPT captures are recaptured.

## Included Artifacts

- `docs/REPO_TRANSFER_RC2A_HYGIENE_REPORT.md`
- `docs/REPO_TRANSFER_TRIAL_RESULTS.md`
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
- `fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/human_audit_ledger.json`
- `fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/human_audit_ledger.md`

## Current Status

- Historical run: `repo-transfer-12x5-2026-05-01`
- Hygiene status: `recapture_required`
- Invalid ChatGPT capture outputs: `42`
- Contaminated ChatGPT capture outputs: `42`
- Missing ChatGPT capture outputs: `0`
- Contaminated cases: `42`
- `campaign:integrity`: expected fail under RC2a validation
- `repo-transfer:score-run`: expected fail until recapture

Fresh recapture run:

- Run: `repo-transfer-12x5-rc2a-2026-05-02`
- Hygiene status: `recapture_required`
- Invalid ChatGPT capture outputs: `60`
- Contaminated ChatGPT capture outputs: `0`
- Missing ChatGPT capture outputs: `60`
- STAX outputs: refreshed locally
- ChatGPT outputs: not captured yet
- Human audit ledger: pending sample of 15 rows, not reviewed yet

## Allowed Claim

STAX now catches RC2 capture contamination, catches missing raw ChatGPT captures, and refuses to score/write a repo-transfer run until recapture.

The clean-run command-proof profile is available for the eventual clean recapture:

```bash
npm run repo-transfer:command-proof -- --run repo-transfer-12x5-rc2a-2026-05-02 --profile clean
```

## Not Allowed Claim

STAX cleanly beat raw ChatGPT `60-0` on the repo-transfer run.

## Next Action

Run a fresh all-60 ChatGPT recapture using the copy-response capture path, then regenerate canonical scores only after:

```bash
npm run repo-transfer:capture-hygiene -- --run <new-run>
npm run campaign:integrity -- --run <new-run>
npm run repo-transfer:score-run -- --run <new-run> --write
```
