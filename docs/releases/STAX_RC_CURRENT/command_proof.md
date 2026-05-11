# STAX RC Current Command Proof

Generated: 2026-05-11T21:18:55Z

## Baseline

```txt
Repo: /Users/deanguedo/Documents/GitHub/STAX
Branch: main
HEAD: 8b6c8c139e1bf81bfc7e181d7487dca0b1dd9828
origin/main: 8b6c8c139e1bf81bfc7e181d7487dca0b1dd9828
Local/remote code alignment: aligned at command time
```

## Required Commands

| Command | Exit | Evidence |
| --- | ---: | --- |
| `npm ci` | 0 | added 56 packages, audited 57 packages, found 0 vulnerabilities |
| `npm run typecheck` | 0 | `tsc --noEmit` completed successfully |
| `npm test` | 0 | 190 test files passed, 954 tests passed |
| `npm run smoke:stax` | 0 | smoke run completed; run id `run-2026-05-11T21-18-49-045Z-jz9r0q` |
| `npm run rax -- eval` | 0 | 16 evals passed, 0 failed, pass rate 1 |

## Smoke Evidence

`npm run smoke:stax` produced a planning-mode STAX system improvement plan and
recorded:

```txt
Run: run-2026-05-11T21-18-49-045Z-jz9r0q
Run folder: runs/2026-05-11/run-2026-05-11T21-18-49-045Z-jz9r0q
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

## Phase 0 Gate Result

```txt
Status: Pass
Reason: All required Phase 0 commands completed with exit code 0.
Boundary: This proves the current local command baseline only. It does not prove
public release readiness, hard-gate readiness, or correctness of future changes.
```
