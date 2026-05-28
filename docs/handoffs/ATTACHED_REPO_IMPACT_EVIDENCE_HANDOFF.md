# Attached Repo Impact Evidence Handoff

Date: 2026-05-28

## Purpose

Use this handoff when the live attached repos are current on a different workstation.

The STAX repo can evaluate imported evidence, but current operating-window claims require bundles exported from the machine that actually has the current repo checkouts. This handoff keeps that process narrow, non-mutating, and repeatable.

## Scope

This handoff is for evidence collection only.

Allowed:

```txt
sidecar upgrade/discovery
sidecar gate
sidecar next prompt generation
impact evidence export
pattern impact import back into STAX
```

Blocked unless the user explicitly asks:

```txt
deploy
publish
sync
release
live LMS mutation
git push from attached repos
auto-promotion
hard-gating ordinary local editing
```

## Current STAX Baseline

Use the current `origin/main` STAX checkout at or after:

```txt
1a87f23 Refresh active handoff baseline guidance
```

Before exporting live repo evidence, verify the local STAX checkout:

```bash
cd /Users/deanguedo/Documents/GitHub/STAX
git status --short --branch
git log -3 --oneline
npm run typecheck
npm test
npm run smoke:stax
npm run rax -- eval
```

Do not claim a command passed unless the command output and exit code are present.

## Target Repos

Run only against repos that are current and not being actively edited in another terminal:

```txt
/Users/deanguedo/Documents/GitHub/canvas-helper
/Users/deanguedo/Documents/GitHub/ADMISSION-APP
/Users/deanguedo/Documents/GitHub/brightspacequizexporter
```

Optional later targets:

```txt
/Users/deanguedo/Documents/GitHub/studentbudgetwars
/Users/deanguedo/Documents/GitHub/Course-factoryPERFECT
/Users/deanguedo/Documents/GitHub/Brightpsace-converter-project
```

## Per-Repo Export Flow

Run from the STAX repo.

For one repo:

```bash
npm run stax:sidecar-upgrade -- --repo /Users/deanguedo/Documents/GitHub/canvas-helper --discover-surfaces
npm run stax:gate -- --repo /Users/deanguedo/Documents/GitHub/canvas-helper
npm run stax:next-prompt -- --repo /Users/deanguedo/Documents/GitHub/canvas-helper --no-gate
npm run stax:export-impact-evidence -- \
  --repo /Users/deanguedo/Documents/GitHub/canvas-helper \
  --out reports/pattern_promotion/attached_repo_exports/canvas-helper-impact.json
```

Repeat with the repo path and output filename changed for each attached repo.

## Guarded Batch Flow

Dry-run first:

```bash
npm run stax:attached-impact-export -- \
  --dry-run \
  --repo /Users/deanguedo/Documents/GitHub/canvas-helper \
  --repo /Users/deanguedo/Documents/GitHub/ADMISSION-APP \
  --repo /Users/deanguedo/Documents/GitHub/brightspacequizexporter \
  --out-dir reports/pattern_promotion/attached_repo_exports
```

If the listed repos are current and idle, run:

```bash
npm run stax:attached-impact-export -- \
  --confirm-current-repos \
  --repo /Users/deanguedo/Documents/GitHub/canvas-helper \
  --repo /Users/deanguedo/Documents/GitHub/ADMISSION-APP \
  --repo /Users/deanguedo/Documents/GitHub/brightspacequizexporter \
  --out-dir reports/pattern_promotion/attached_repo_exports
```

Use `--continue-on-error` only when the goal is to preserve partial evidence from multiple repos after one repo fails.

## Import Flow Back Into STAX

After exported bundles are available in the STAX repo:

```bash
npm run pattern:impact \
  -- --import reports/pattern_promotion/attached_repo_exports/canvas-helper-impact.json \
  --import reports/pattern_promotion/attached_repo_exports/ADMISSION-APP-impact.json \
  --import reports/pattern_promotion/attached_repo_exports/brightspacequizexporter-impact.json
```

The import should update:

```txt
docs/RAX_PATTERN_PROMOTION_IMPACT_REPORT.md
reports/pattern_promotion/pattern-promotion-impact-*.json
```

## Evidence Bundle Must Include

Each bundle should carry:

```txt
repo path
repo name
branch
HEAD
dirty status
STAX commit
sidecar protocol version
proof-surface version
task
STAX output
Codex report
command evidence
artifacts
critical miss
cleanup prompt needed
full handoff contract present
proof artifact requested
```

## Acceptance Criteria

The export/import pass is acceptable when:

```txt
each target repo was current before export
sidecar upgrade did not erase task/status/report/evidence files
gate output was captured even if verdict was not Accept
next prompt was captured
impact bundle schema validation passed
pattern impact import reports 0 critical misses or lists the miss explicitly
docs/RAX_PATTERN_PROMOTION_IMPACT_REPORT.md separates locked replay from current operating-window evidence
```

## Stop Conditions

Stop and report instead of forcing the run if:

```txt
the repo is actively being edited elsewhere
the repo has unexpected source dirt
the sidecar upgrade would overwrite user work
STAX gate reports stale/tampered/wrong-worktree command evidence that needs a fresh collect pass
the command path would deploy, publish, sync, or mutate live systems
```

## Result To Bring Back

Bring back or commit:

```txt
reports/pattern_promotion/attached_repo_exports/*.json
reports/pattern_promotion/attached-repo-impact-export-summary.json
reports/pattern_promotion/pattern-promotion-impact-*.json
docs/RAX_PATTERN_PROMOTION_IMPACT_REPORT.md
```

Also record the attached repo commit SHA used for each bundle in the final report.
