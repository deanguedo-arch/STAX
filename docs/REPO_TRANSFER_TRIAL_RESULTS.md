# Repo Transfer Trial Results

Date: 2026-05-02

## Current Canonical Run

- Run ID: `repo-transfer-12x5-rc2a-2026-05-02`
- Run folder: `fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/`
- External baseline: raw ChatGPT in the Codex in-app browser
- STAX source: local `project_control` output
- Cases: 60
- Repos: 12
- Archetypes: 12

## Canonical Score Summary

- STAX wins: 60
- ChatGPT wins: 0
- Ties: 0
- STAX critical misses: 0
- ChatGPT critical misses: 5
- No local basis: 0
- No external baseline: 0
- Confidence: `benchmark_slice_proven`
- Superiority status: `slice_only`

## Hygiene Summary

- `repo-transfer:capture-hygiene`: `clean`
- Invalid capture outputs: 0
- Contaminated capture outputs: 0
- Missing capture outputs: 0
- `campaign:integrity`: `passed`

## What This Proves

- STAX produced a complete 12x5 public-repo transfer slice with local STAX outputs and fresh raw ChatGPT browser baselines.
- The fresh RC2a capture set has no missing, UI-contaminated, prompt-contaminated, duplicate-section, or wrong-repo capture rows under the strengthened validator.
- Canonical scoring was regenerated from the clean captures and written back to `scores.json` and `report.md`.
- STAX won every case in this scoped project-control transfer slice and had zero critical misses.
- Raw ChatGPT had 5 critical misses under the local adjudication rules.

## What This Does Not Prove

- This is not a general ChatGPT superiority claim.
- This does not prove production readiness.
- This does not prove full public-repo local test execution.
- This does not prove commands in public repos passed; these were project-control audit cases using supplied evidence and browser-captured baselines.
- This does not remove the need for future capture hygiene, comparison integrity, canonical scoring, and command proof.

## Quarantined Historical Run

Historical run:

```txt
fixtures/real_use/runs/repo-transfer-12x5-2026-05-01/
```

RC2a hygiene status for the historical run:

- `repo-transfer:capture-hygiene`: `recapture_required`
- Invalid capture outputs: 42
- Contaminated capture outputs: 42
- Missing capture outputs: 0
- `campaign:integrity`: fails on contaminated ChatGPT captures
- `repo-transfer:score-run`: refuses to score until recapture

The historical RC2 run remains quarantined and must not be used for a clean `60-0` claim.

## Commands Run

```bash
npm run repo-transfer:capture-hygiene -- --run repo-transfer-12x5-rc2a-2026-05-02 --expect-clean --write
npm run campaign:integrity -- --run repo-transfer-12x5-rc2a-2026-05-02
npm run repo-transfer:score-run -- --run repo-transfer-12x5-rc2a-2026-05-02 --write
npm run repo-transfer:command-proof -- --run repo-transfer-12x5-rc2a-2026-05-02 --profile clean
npm run repo-transfer:integrity
npm run typecheck
npm test
npm run rax -- eval
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
npm run campaign:promotion-gate
```

## Next Action

Use the RC2a proof pack as the current public-repo transfer evidence package. Any future repo-transfer claim should use a new run folder and must pass the same capture hygiene, comparison integrity, scoring, command proof, and promotion boundary checks.
