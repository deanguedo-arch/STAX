# Repo Transfer Trial Results

Date: 2026-05-01

## Run

- Run ID: `repo-transfer-12x5-2026-05-01`
- Run folder: `fixtures/real_use/runs/repo-transfer-12x5-2026-05-01/`
- External baseline: raw ChatGPT in Codex in-app browser, Instant model
- STAX source: local `project_control` output
- Cases: 60
- Repos: 12
- Archetypes: 12

## Canonical Score Summary

> RC2a hygiene note, 2026-05-02: this score summary is now treated as provisional.
> A later judge audit found prompt/UI contamination in the ChatGPT baseline captures.
> The strengthened capture-hygiene validator now rejects this run until affected rows are recaptured and rescored. It currently reports 42 invalid historical ChatGPT capture outputs, all contamination-driven.

- STAX wins: 60
- ChatGPT wins: 0
- Ties: 0
- STAX critical misses: 0
- ChatGPT critical misses: 0
- No local basis: 0
- No external baseline: 0
- Confidence: `benchmark_slice_proven`
- Superiority status: `slice_only`

## What This Proves

- STAX produced a complete first 12x5 public-repo transfer slice with local STAX outputs and browser-captured ChatGPT baselines.
- STAX did not leak local ADMISSION-APP proof surfaces into public-repo transfer outputs after the transfer-specific guard was added.
- The run has complete canonical captures, scores, report, and manifest artifacts.
- The original comparison-integrity gate passed before the RC2a contamination rules existed.

## What This Does Not Prove

- This does not currently prove a clean 60-0 win; the run is quarantined until contaminated ChatGPT rows are recaptured.
- This does not independently prove zero critical misses from a separate critical-miss adjudication path in the original RC2 score file.
- This is not a general ChatGPT superiority claim.
- This does not prove production readiness.
- This does not prove full public-repo local test execution.
- This does not prove commands in public repos passed; these were project-control audit cases using supplied evidence and browser-captured baselines.

## Commands Run

```bash
npm run repo-transfer:prepare -- --run repo-transfer-12x5-2026-05-01
npm run repo-transfer:refresh-stax -- --run repo-transfer-12x5-2026-05-01
npm run repo-transfer:score-run -- --run repo-transfer-12x5-2026-05-01 --write
npm run campaign:integrity -- --run repo-transfer-12x5-2026-05-01
npm run repo-transfer:integrity
npm run typecheck
npm test
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
npm run rax -- eval
```

## RC2a Hygiene Commands

```bash
npm run repo-transfer:capture-hygiene -- --run repo-transfer-12x5-2026-05-01 --write
npm run campaign:integrity -- --run repo-transfer-12x5-2026-05-01
npm run repo-transfer:score-run -- --run repo-transfer-12x5-2026-05-01
```

Expected RC2a status for this historical run:

- `repo-transfer:capture-hygiene`: `recapture_required`
- `campaign:integrity`: fails on contaminated ChatGPT captures
- `repo-transfer:score-run`: refuses to score until recapture

Fresh RC2a recapture run:

```bash
npm run repo-transfer:prepare -- --run repo-transfer-12x5-rc2a-2026-05-02
npm run repo-transfer:refresh-stax -- --run repo-transfer-12x5-rc2a-2026-05-02
npm run repo-transfer:capture-hygiene -- --run repo-transfer-12x5-rc2a-2026-05-02 --write
```

Expected status for the fresh run before browser capture:

- `repo-transfer:capture-hygiene`: `recapture_required`
- Invalid capture outputs: `60`
- Contaminated capture outputs: `0`
- Missing capture outputs: `60`

After clean recapture, the proof packet must be generated with:

```bash
npm run repo-transfer:command-proof -- --run repo-transfer-12x5-rc2a-2026-05-02 --profile clean
npm run repo-transfer:human-audit:prepare -- --run repo-transfer-12x5-rc2a-2026-05-02 --sample-size 15
```

The `clean` command-proof profile records the full validation packet, including hygiene, comparison integrity, canonical score writing, repo-transfer integrity, typecheck, tests, `rax eval`, and the STAX fitness smoke run.

## Next Action

Recapture all 60 ChatGPT baseline rows into `repo-transfer-12x5-rc2a-2026-05-02` using the copy-response path, then regenerate canonical scores and release a clean RC2a proof pack only if the strengthened integrity gate passes.
