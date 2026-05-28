# STAX RC Current Command Proof

Generated: 2026-05-28T17:16:00Z

## Baseline

```txt
Repo: /Users/deanguedo/Documents/GitHub/STAX
Branch: main
HEAD: 994585538b29d96157e5fa67aba693114513c766
origin/main: 994585538b29d96157e5fa67aba693114513c766
Local/remote code alignment: aligned at command time
```

## Required Commands

| Command | Exit | Evidence |
| --- | ---: | --- |
| `npm ci` | 0 | added 56 packages, audited 57 packages, found 0 vulnerabilities |
| `npm run typecheck` | 0 | `tsc --noEmit` completed successfully |
| `npm test` | 0 | 212 test files passed, 1125 tests passed |
| `npm run smoke:stax` | 0 | smoke run completed; run id `run-2026-05-28T17-15-46-614Z-ko5gm1` |
| `npm run rax -- eval` | 0 | 16 evals passed, 0 failed, pass rate 1 |

## Smoke Evidence

`npm run smoke:stax` produced a planning-mode STAX system improvement plan and
recorded:

```txt
Run: run-2026-05-28T17-15-46-614Z-ko5gm1
Run folder: runs/2026-05-28/run-2026-05-28T17-15-46-614Z-ko5gm1
```

## Eval Evidence

`npm run rax -- eval` returned:

```json
{
  "total": 16,
  "passed": 16,
  "failed": 0,
  "passRate": 1,
  "criticalFailures": 0
}
```

## Rollout Phase Gate

The rollout phase gate was also refreshed on this checkout:

```txt
Command: npm run stax:rollout:gate
Exit: 0
Status: passed
Report: docs/releases/ROLLOUT_PHASE_GATE/report.md
Status artifact: docs/releases/ROLLOUT_PHASE_GATE/status.json
```

## Phase 0 Gate Result

```txt
Status: Pass
Reason: All required Phase 0 commands completed with exit code 0 on current pushed main.
Boundary: This proves the current local command baseline only. It does not prove
public release readiness, broad hard-gate readiness, attached-repo freshness, or
correctness of future changes.
```
