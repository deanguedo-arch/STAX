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

- STAX handled the first 12x5 public-repo transfer slice better than the captured raw ChatGPT baseline under the local benchmark scorer.
- STAX did not leak local ADMISSION-APP proof surfaces into public-repo transfer outputs after the transfer-specific guard was added.
- The run has complete canonical captures, scores, report, and manifest artifacts.
- The comparison-integrity gate passed for the run folder.

## What This Does Not Prove

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

## Next Action

Promote the strongest misses/edges from this run into durable evals only if future review finds a repeated failure pattern. Do not expand architecture from this result alone.
