# STAX Release Artifact Manifest - 2026-05-26

## Artifact

- File: `dean-stax-hardened-1.zip`
- Local path: `/Users/deanguedo/Downloads/dean-stax-hardened-1.zip`
- Extracted path: `/Users/deanguedo/Downloads/dean-stax-hardened-1-extracted/STAX-main-hardened`
- SHA-256: `ce98e31ab179116830e7ef05e819f8bef029cb8872dffcd67aa1401d7a642c7e`
- Verification command:

```bash
shasum -a 256 /Users/deanguedo/Downloads/dean-stax-hardened-1.zip
```

## Source Linkage

- Live STAX repo inspected at commit: `a07c921af52dcebedeae6bcdf99b1823360e8d9d`
- Archive did not include `.git` metadata or a `BUILD_INFO.json` file.
- Source-to-artifact linkage is therefore provisional: the artifact hash proves file identity, but the artifact itself does not independently prove its source commit.

## Allowed Claim

STAX is a scoped 9.5 local proof gate for Dean's Codex/repo project-control workflow.

## Blocked Claims

- Broad ChatGPT superiority.
- Production-ready autonomous agent.
- Arbitrary-domain reasoning superiority.
- Real repo auto-apply.
- Git push, deploy, publish, or release authority.
- Code correctness proof.
- Tamper-proof local security boundary against privileged local adversaries.

## Validation Required Before Release Use

Run from the extracted artifact folder:

```bash
npm ci
npm run typecheck
npm test
npm run smoke:stax
npm run rax -- eval
npm run rax -- eval --regression
npm run rax -- eval --redteam
npm run campaign:operating-window:today
npm run pattern:impact
```

## Validation Status

- Checksum verification: passed locally.
- Extracted artifact inspection: passed locally.
- `npm ci` from extracted artifact: passed locally.
- `npm run typecheck` from extracted artifact: passed locally.
- `npm test` from extracted artifact: failed locally, 210 test files passed and 1 test file failed, with 1089 passed tests and 1 failed test.
- Full validation suite from extracted artifact: failed; do not promote this zip as a validated baseline yet.
- Attached-repo sidecar upgrade trial from this artifact: not yet run for this manifest.
- Impact-evidence import/export proof: not yet run for this manifest.

## Recommended Use

Use this artifact as a release-candidate input only. It should not become the sidecar rollout baseline until the failing test is fixed and the validation suite passes from the extracted folder. Then use the validated artifact to upgrade attached sidecars and collect impact evidence from live repos.

Do not treat the hash as behavioral proof. The hash only proves artifact identity.

## Blocking Failure

Command:

```bash
npm test
```

Result:

```txt
Test Files  1 failed | 210 passed (211)
Tests       1 failed | 1089 passed (1090)
```

Failing test:

```txt
tests/sidecarAttachGate.test.ts > STAX sidecar attach and gate > uses npm CLI entrypoints when spawning package binaries on Windows
```

Observed mismatch:

```txt
expected npx path: C:\tools\node\node_modules\npm\bin\npx-cli.js
received npx path: npx-cli.js
```

Release decision: do not use `dean-stax-hardened-1.zip` as the validated sidecar baseline until this Windows npm/npx entrypoint issue is repaired and the full suite passes.

## Follow-Up Repair Status

The live STAX checkout was patched after the artifact failure. The fix changes Windows npm/npx CLI path resolution in `src/sidecar/VisualEvidenceCollector.ts` to use Windows path semantics when `platform` is `win32`.

Live checkout validation after the fix:

- `npm test -- tests/sidecarAttachGate.test.ts`: passed, 17 tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 209 files and 1082 tests.
- `npm run smoke:stax`: passed.
- `npm run rax -- eval`: passed, 16/16.
- `npm run rax -- eval --regression`: passed, 49/49.
- `npm run rax -- eval --redteam`: passed, 15/15.
- `npm run campaign:operating-window:today`: passed, 5/5 and 0 critical misses.
- `npm run pattern:impact`: passed locked replay with 10 cases, 0 critical misses, 8 improved, 2 unchanged-safe, 0 regressed.

This validates the repaired live source, not the original checksum-locked zip. A new artifact and new SHA are required before sidecar rollout.

## Repaired Artifact

Artifact:

```txt
/Users/deanguedo/Downloads/dean-stax-hardened-repaired-2026-05-27.zip
```

SHA-256:

```txt
a010d67519b620c84a67b5c3ce0c0468f9ebfd991d090ef4f61bd9e291dd2ad2
```

Fresh extraction:

```txt
/Users/deanguedo/Downloads/dean-stax-hardened-repaired-2026-05-27-extracted/STAX-main-hardened-repaired
```

The repaired artifact includes:

- Generic STAX hardening primitives.
- Repo hygiene audit.
- `.node-version`, `.npmrc`, and `SECURITY.md`.
- Stronger sidecar command-risk detection.
- Stricter structured command argument rules.
- Windows npm/npx CLI path repair for visual proof collection.

The repaired artifact intentionally excludes:

- Dean app vertical code.
- Dean health/training/nutrition domain logic.
- Attached-repo sidecar mutations.

Validation from fresh extraction:

- `npm ci`: passed.
- `npm run validate:hardened`: passed, 210 files and 1087 tests.
- `npm run smoke:stax`: passed.
- `npm run rax -- eval`: passed, 16/16.
- `npm run rax -- eval --regression`: passed, 49/49.
- `npm run rax -- eval --redteam`: passed, 15/15.
- `npm run campaign:operating-window:today`: passed, 5/5 and 0 critical misses.
- `npm run pattern:impact`: passed locked replay with 10 cases, 0 critical misses, 8 improved, 2 unchanged-safe, 0 regressed. Current operating window had 0 imported bundles in this local artifact run.

Release decision: this repaired artifact is the validated candidate for attached-repo sidecar rollout testing. It is still mapped to a working-tree source state, not a clean pushed release commit. For a final public release, commit the source, rebuild the artifact from that commit, and generate a final SHA.

## Final Commit-Mapped Artifact

Artifact:

```txt
/Users/deanguedo/Downloads/dean-stax-hardened-final-2026-05-27.zip
```

SHA-256:

```txt
d1ba777b2536a5cdfc114fc236213e3373b006277e403e49d609f04daaccb8a2
```

Source commit:

```txt
9828ef7d6642810385659a017beca6ae9bec3529
```

Fresh extraction:

```txt
/Users/deanguedo/Downloads/dean-stax-hardened-final-2026-05-27-extracted/STAX-main-hardened-final
```

Validation from the fresh extraction:

- `npm ci`: passed.
- `npm run validate:hardened`: passed.
- `npm run smoke:stax`: passed.
- `npm run rax -- eval`: passed, 16/16 and 0 critical failures.
- `npm run rax -- eval --regression`: passed, 49/49 and 0 critical failures.
- `npm run rax -- eval --redteam`: passed, 15/15 and 0 critical failures.
- `npm run campaign:operating-window:today`: passed, 5/5 and 0 critical misses.
- `npm run pattern:impact`: passed locked replay with 10 cases, 0 critical misses, 8 improved, 2 unchanged-safe, 0 regressed. Current operating-window imported bundles: 0.

Release decision: this final artifact is commit-mapped and validated for attached-repo sidecar rollout testing. It still does not authorize broad ChatGPT superiority claims, autonomous production use, real-repo auto-apply, git push/deploy/publish authority, or code correctness proof.
