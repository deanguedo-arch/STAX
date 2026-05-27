# Validation Results - dean-stax-hardened-1.zip

Artifact: `dean-stax-hardened-1.zip`

SHA-256:

```txt
ce98e31ab179116830e7ef05e819f8bef029cb8872dffcd67aa1401d7a642c7e
```

Extracted path:

```txt
/Users/deanguedo/Downloads/dean-stax-hardened-1-extracted/STAX-main-hardened
```

## Commands

```bash
npm ci
```

Exit code: 0

Summary: installed 56 packages, audited 57 packages, 0 vulnerabilities.

```bash
npm run typecheck
```

Exit code: 0

Summary: TypeScript completed with no reported errors.

```bash
npm test
```

Exit code: 1

Summary:

```txt
Test Files  1 failed | 210 passed (211)
Tests       1 failed | 1089 passed (1090)
```

Failing test:

```txt
tests/sidecarAttachGate.test.ts > STAX sidecar attach and gate > uses npm CLI entrypoints when spawning package binaries on Windows
```

Mismatch:

```txt
Expected args:
  C:\tools\node\node_modules\npm\bin\npx-cli.js
  --no-install

Received args:
  npx-cli.js
  --no-install
```

## Verdict

This exact zip is checksum-verified, but it is not a validated release baseline. The artifact must not be used as the sidecar rollout baseline until the Windows npm/npx entrypoint test failure is repaired and the full validation suite passes.

## Live Source Repair Follow-Up

The live STAX checkout was patched after this artifact failure by making `src/sidecar/VisualEvidenceCollector.ts` resolve Windows npm/npx CLI paths with `path.win32`.

These commands were then run from the live checkout, not from the original zip:

```bash
npm test -- tests/sidecarAttachGate.test.ts
```

Exit code: 0

Summary: 1 test file passed, 17 tests passed.

```bash
npm run typecheck
```

Exit code: 0

```bash
npm test
```

Exit code: 0

Summary: 209 test files passed, 1082 tests passed.

```bash
npm run smoke:stax
```

Exit code: 0

```bash
npm run rax -- eval
```

Exit code: 0

Summary: 16/16 passed, 0 critical failures.

```bash
npm run rax -- eval --regression
```

Exit code: 0

Summary: 49/49 passed, 0 critical failures.

```bash
npm run rax -- eval --redteam
```

Exit code: 0

Summary: 15/15 passed, 0 critical failures.

```bash
npm run campaign:operating-window:today
```

Exit code: 0

Summary: 5/5 passed, 0 critical misses.

```bash
npm run pattern:impact
```

Exit code: 0

Summary: locked replay 10 cases, 0 critical misses, 8 improved, 2 unchanged-safe, 0 regressed. Current operating window had 0 imported bundles in this run.

Release implication: create a new artifact from the patched live source and generate a new SHA before using it as the sidecar rollout baseline.
