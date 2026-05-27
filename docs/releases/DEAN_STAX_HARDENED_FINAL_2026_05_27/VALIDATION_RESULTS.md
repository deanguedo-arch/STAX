# Dean STAX Hardened Final Artifact Validation - 2026-05-27

## Artifact

- File: `dean-stax-hardened-final-2026-05-27.zip`
- SHA-256: `d1ba777b2536a5cdfc114fc236213e3373b006277e403e49d609f04daaccb8a2`
- Source commit: `9828ef7d6642810385659a017beca6ae9bec3529`
- Fresh extraction: `/Users/deanguedo/Downloads/dean-stax-hardened-final-2026-05-27-extracted/STAX-main-hardened-final`

## Validation

Commands run from the fresh extraction:

```bash
npm ci
npm run validate:hardened
npm run smoke:stax
npm run rax -- eval
npm run rax -- eval --regression
npm run rax -- eval --redteam
npm run campaign:operating-window:today
npm run pattern:impact
```

Results:

- `npm ci`: passed, 56 packages installed, 0 vulnerabilities.
- `npm run validate:hardened`: passed.
  - `typecheck`: passed.
  - `build`: passed.
  - `audit:doctrine`: passed.
  - `audit:boundaries`: passed.
  - `audit:security`: passed, 885 files scanned, 17 allowed fixture findings.
  - `audit:repo-hygiene`: passed with local generated-directory warnings for `node_modules/` and `dist/`.
  - `test:ci-safe`: passed, 210 files and 1088 tests.
- `npm run smoke:stax`: passed.
- `npm run rax -- eval`: passed, 16/16, 0 critical failures.
- `npm run rax -- eval --regression`: passed, 49/49, 0 critical failures.
- `npm run rax -- eval --redteam`: passed, 15/15, 0 critical failures.
- `npm run campaign:operating-window:today`: passed, 5/5, 0 critical misses.
- `npm run pattern:impact`: passed locked replay with 10 cases, 0 critical misses, 8 improved, 2 unchanged-safe, 0 regressed. Current operating-window imported bundles: 0.

## Notes

- The artifact was built after `test:ci-safe` was capped to `vitest run --maxWorkers=4` to reduce worker-pool flakiness during hardened validation.
- This artifact is validated for attached-repo sidecar rollout testing.
- This artifact does not prove general code correctness, broad ChatGPT superiority, autonomous production readiness, or deploy/publish authority.
