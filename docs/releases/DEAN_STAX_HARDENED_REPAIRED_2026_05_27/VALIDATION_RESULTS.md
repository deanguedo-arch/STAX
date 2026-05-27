# Validation Results - Repaired STAX Hardened Artifact

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

## Scope

This artifact is the repaired successor to `dean-stax-hardened-1.zip`.

It includes generic STAX hardening primitives and the Windows npm/npx path repair. It does not include Dean app vertical code.

## Commands

```bash
npm ci
```

Exit code: 0

Summary: installed 56 packages, audited 57 packages, 0 vulnerabilities.

```bash
npm run validate:hardened
```

Exit code: 0

Summary:

```txt
Doctrine audit passed.
Boundary audit passed.
Security audit passed.
Repo hygiene audit passed.
Test Files  210 passed (210)
Tests       1087 passed (1087)
```

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

Summary: locked replay 10 cases, 0 critical misses, 8 improved, 2 unchanged-safe, 0 regressed. Current operating window had 0 imported bundles in this local artifact run.

## Verdict

The repaired artifact is checksum-verified and passed validation from a fresh extraction. It is a valid candidate for attached-repo sidecar rollout testing.

Remaining limitation: the artifact was built from a live working-tree source state, not a clean pushed release commit. For final public release, commit the source, rebuild from that commit, and generate a final SHA.
