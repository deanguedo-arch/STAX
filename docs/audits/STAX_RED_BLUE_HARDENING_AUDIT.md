# STAX Red/Blue Hardening Audit

Date: 2026-05-14

Status: GitHub-facing audit artifact added after hardening review.

## Current Reviewer Assessment

The GitHub `main` branch is materially stronger than earlier local snapshots.
The review scored the repo at approximately `0.91`: strong and defensible, but
not final.

## Hardening That Landed

- Direct dependencies and dev dependencies are pinned.
- `validate:hardened`, `test:ci-safe`, and `test:unit` exist.
- Structured command execution exists through executable, args, and cwd instead
  of raw shell strings.
- Shell-shaped arguments and unsafe metacharacters are blocked.
- Unsafe command injection cases are covered by tests.
- Verification paths route allowed commands through structured command helpers.
- Local evidence collection routes git evidence through structured command
  helpers.
- GitHub Actions includes a strict STAX Core workflow that runs install,
  targeted adapter tests, hardened validation, and the strict release gate.

## Remaining Concerns

The main risk is now complexity debt, not obvious command-execution looseness.
STAX is proof-heavy and governance-oriented, but a new maintainer still has to
cross too much historical surface area.

Current concerns:

- The repo is still large and self-referential.
- Some campaign and report machinery remains visible beside the public product
  path.
- New users need a clearer route from attach to proof surface review to gate.
- Large agent, CLI, and session modules should be split only where it reduces
  real maintenance load.
- Local path assumptions should keep moving into workspace profiles or sidecar
  config.
- Every command path should continue moving toward structured command helpers.
- Old generated reports should be archived aggressively once superseded.

## Non-Claims

This audit does not claim:

- broad ChatGPT superiority
- production-ready autonomous agents
- arbitrary-domain reasoning superiority
- git push, deploy, publish, or sync authority
- code correctness proof

## Next Compression Work

Recommended next work:

1. Keep GitHub Actions as the remote truth gate.
2. Make public attach and proof-surface review simple enough for a new user.
3. Archive old generated reports behind `docs/ARCHIVE_INDEX.md`.
4. Split large runtime surfaces only when the split makes tests or ownership
   clearer.
5. Keep adding adversarial tests before adding features.

The correct next move is compression and operational clarity, not a new layer of
autonomy.
