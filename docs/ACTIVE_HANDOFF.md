# Active Handoff

Date: 2026-05-27

## Current Workstream

This handoff is for continuing the STAX rollout from the current pushed `main` state.

Repo:

```txt
/Users/deanguedo/Documents/GitHub/STAX
```

Branch:

```txt
main
```

Published baseline:

```txt
759e9d33f3d4eb41cf75ce295708e252f0df14ec
```

Latest pushed commit:

```txt
759e9d3 Accept approved workflow proof in STAX gate
```

GitHub Actions proof:

```txt
staxcore-strict: completed / success
run: https://github.com/deanguedo-arch/STAX/actions/runs/26517746531
```

Local `main` and `origin/main` were aligned when this handoff was written.

Do not route this handoff into local `canvas-helper` work on this machine. The local `canvas-helper` checkout is not current enough for sidecar rollout. Run attached-repo rollout only on the workstation that has the current attached repos.

## Product Boundary

STAX remains a local proof gate for AI-coded repo work.

Allowed claim:

```txt
STAX is a scoped local proof gate for Dean's Codex/repo project-control workflow.
```

Blocked claims:

```txt
broad ChatGPT superiority
production-ready autonomous agent
real repo auto-apply
git push / deploy / publish authority
arbitrary-domain superiority
code correctness proof
```

Do not broaden this work into a generic AI runtime, new agent system, deploy system, sync system, or auto-promotion loop.

## What Just Landed

The STAX repo is current and pushed. Attached repos were intentionally not touched on this computer.

The recent STAX work landed these main changes:

- Generic hardening primitives from the Dean hardened artifact were integrated without Dean app/domain logic.
- `validate:hardened` now includes the strengthened audit chain and full test profile.
- Repo hygiene audit was added.
- Hardened command-risk and structured-command tests were added.
- Security audit commands are recognized as executable proof in command intelligence and project-control proof mapping.
- Windows npm/npx path resolution was repaired in visual evidence collection.
- Final hardened artifact documentation was written under `docs/releases/DEAN_STAX_HARDENED_FINAL_2026_05_27/`.
- GitHub Actions workflows that run `npm ci` now use Node 22, matching the repo's `node >=22 <25` engine policy.
- STAX project-control proof stack now recognizes approved `.github/workflows/*` runtime edits as workflow/config diff proof during sidecar review.
- Vitest timeout budget was raised to 60 seconds for slower full-suite runs.

Important pushed commits:

```txt
3eba359 Harden STAX release artifact controls
9828ef7 Stabilize hardened validation test workers
7b8b1ca Document final hardened artifact validation
8ef227c Align GitHub Actions Node runtime
759e9d3 Accept approved workflow proof in STAX gate
```

## Final Hardened Artifact

Final validated artifact:

```txt
/Users/deanguedo/Downloads/dean-stax-hardened-final-2026-05-27.zip
```

SHA-256:

```txt
d1ba777b2536a5cdfc114fc236213e3373b006277e403e49d609f04daaccb8a2
```

Source commit recorded in artifact build info:

```txt
9828ef7d6642810385659a017beca6ae9bec3529
```

Validation recorded in:

```txt
docs/releases/DEAN_STAX_HARDENED_FINAL_2026_05_27/BUILD_INFO.json
docs/releases/DEAN_STAX_HARDENED_FINAL_2026_05_27/VALIDATION_RESULTS.md
```

The final source baseline moved past that artifact commit because the CI runtime and self-gate fixes were pushed afterward. Use current `main` (`759e9d3`) for development and sidecar rollout tooling.

## Proof Already Collected

Current local proof after the final pushed commit:

```txt
npm run validate:hardened: pass
- typecheck: pass
- build: pass
- doctrine audit: pass
- boundary audit: pass
- security audit: pass
- repo hygiene audit: pass
- test:ci-safe: pass, 210 files / 1089 tests

npm run validate:staxcore:strict:ci: pass
- strict release gate passed on retry
- final score: 100/A
- npm test: pass, 210 files / 1089 tests
- eval: 16/16
- regression eval: 49/49
- redteam eval: 15/15

GitHub Actions:
- staxcore-strict on 759e9d3: success

STAX sidecar gate:
- verdict: Accept
- proof strength: Strong (0.73)
- protocol: warning only for current-turn capture lag
```

Current sidecar proof is intentionally local proof state. Do not commit generated `.stax/status.json`, `.stax/proof_strength.json`, or `.stax/reports/*` unless Dean explicitly asks.

## Current Local Dirt

Expected local generated proof files may be dirty:

```txt
.stax/status.json
.stax/proof_strength.json
.stax/next-codex-prompt.md
.stax/reports/latest-proof-report.md
.stax/reports/latest-confidence-report.md
```

There is also an unrelated untracked duplicate handoff:

```txt
docs/ACTIVE_HANDOFF 2.md
```

It was not touched in the STAX hardening/CI pass. Do not delete it unless Dean explicitly asks.

## Work-Terminal Next Steps

The next milestone is attached-repo current operating-window proof. Do this only on the workstation that has current repo checkouts.

Target repos:

```txt
canvas-helper
ADMISSION-APP
brightspacequizexporter
STAX
```

For each current repo, run:

```bash
npm run stax:sidecar-upgrade -- --repo <repo> --discover-surfaces
npm run stax:gate -- --repo <repo>
npm run stax:next-prompt -- --repo <repo>
npm run stax:export-impact-evidence -- --repo <repo> --out <repo-impact.json>
```

Bring exported bundles back to STAX and import them:

```bash
npm run pattern:impact -- --import <repo-impact.json>
```

For multiple bundles:

```bash
npm run pattern:impact \
  -- --import canvas-helper-impact.json \
  --import admission-app-impact.json \
  --import brightspacequizexporter-impact.json
```

## Current Acceptance Target

Minimum target for the next operating-window milestone:

```txt
10 real tasks
3 repos minimum
0 critical misses
7/10 full handoff contract present
7/10 correct proof artifact requested
cleanup prompts tracked
```

Keep these claims separate:

```txt
Locked replay = proves STAX behavior changed on frozen cases.
Current operating window = proves STAX helps live repos today.
```

## What Not To Do Next

Do not:

```txt
auto-promote anything
build adaptive sandbox loop yet
run deploy / publish / sync
hard-gate ordinary local editing
claim STAX proves code correctness
touch stale attached-repo checkouts on this machine
```

## Fresh Chat Startup Prompt

Use this exact prompt in the next Codex chat:

```txt
docs/ACTIVE_HANDOFF.md

We are continuing STAX work in /Users/deanguedo/Documents/GitHub/STAX.

First read:
- /Users/deanguedo/Documents/GitHub/STAX/docs/ACTIVE_HANDOFF.md
- /Users/deanguedo/Documents/GitHub/STAX/AGENTS.md
- /Users/deanguedo/Documents/GitHub/STAX/.stax/status.json
- /Users/deanguedo/Documents/GitHub/STAX/.stax/next-codex-prompt.md

Then verify:
- git status --short --branch
- git log -5 --oneline
- git ls-remote origin refs/heads/main

Current published baseline:
- commit: 759e9d33f3d4eb41cf75ce295708e252f0df14ec
- short: 759e9d3
- commit message: Accept approved workflow proof in STAX gate
- GitHub Actions strict run: success
- CI URL: https://github.com/deanguedo-arch/STAX/actions/runs/26517746531

Goal:
Continue the attached-repo operating-window phase only from a workstation with current attached repos. Do not use a stale local `canvas-helper` checkout for sidecar rollout.

On current attached repos, run:
- npm run stax:sidecar-upgrade -- --repo <repo> --discover-surfaces
- npm run stax:gate -- --repo <repo>
- npm run stax:next-prompt -- --repo <repo>
- npm run stax:export-impact-evidence -- --repo <repo> --out <repo-impact.json>

Back in STAX, import exported bundles with:
- npm run pattern:impact -- --import <repo-impact.json>

Before claiming completion in STAX, run:
- npm run typecheck
- npm test

If integrity-path or release-gate behavior changes, also run:
- npm run validate:hardened
- npm run validate:staxcore:strict:ci

Use STAX sidecar proof for repo changes:
- npm run stax:collect -- --repo /Users/deanguedo/Documents/GitHub/STAX -- <command>
- npm run stax:gate -- --repo /Users/deanguedo/Documents/GitHub/STAX

Keep the final answer short and evidence-backed.
```

## Stop Condition

The STAX hardening, artifact documentation, CI runtime repair, self-gate repair, and updated active handoff are complete when:

```txt
docs/ACTIVE_HANDOFF.md is committed and pushed
origin/main equals local main
GitHub staxcore-strict remains success on the pushed commit
generated .stax proof files remain unstaged
attached repos remain untouched on this machine
```
