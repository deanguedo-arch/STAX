# STAX Commands

STAX should feel small from the outside.

The public product surface is:

```bash
npm run stax:attach -- --repo <path>
npm run stax:collect -- --repo <path> -- <command>
npm run stax:collect-visual -- --repo <path> (--path <screenshot> | --url <url>) --description <text>
npm run stax:gate -- --repo <path>
npm run stax:status -- --repo <path>
npm run stax:next -- --repo <path>
npm run stax:discover-surfaces -- --repo <path>
npm run stax:approve-surfaces -- --repo <path>
```

The built/installed CLI shape is:

```bash
stax attach --repo <path>
stax collect --repo <path> -- <command>
stax collect-visual --repo <path> --path <screenshot> --description <text>
stax gate --repo <path>
stax status --repo <path>
stax next --repo <path>
```

`stax:status` reads the last known status. It does not force a fresh audit.
Use `stax:gate` whenever the repo, Codex report, or command evidence changed.

Proof-surface discovery writes candidate local rules:

```txt
.stax/proof-surfaces.candidate.json
.stax/proof-surfaces.review.md
```

Approval writes enforceable local sidecar rules:

```txt
.stax/proof-surfaces.json
```

Candidate surfaces may guide provisional next prompts, but they are not approved
rules until `stax:approve-surfaces` runs.

`stax gate` writes the status card, next prompt, and deterministic proof-strength
artifact:

```txt
.stax/status.md
.stax/status.json
.stax/proof_strength.json
.stax/reports/latest-proof-report.md
.stax/next-codex-prompt.md
```

It also appends or refreshes a generated `## STAX Proof Strength` section in
`.stax/codex-report.md`. STAX strips that generated section before the next
score, so the audit does not grade itself.
When the report avoids hard completion/test/release claims but verified command
evidence exists, STAX still writes proof strength as a `verification_run` so the
captured proof is not invisible.

`stax collect` stores raw command proof outside the attached repo:

```txt
~/.stax/evidence/<repo-id>/command-evidence/
```

The attached repo only gets `.stax/command-evidence/*.pointer.json` files. Those
pointers are not proof; `stax gate` verifies the external ledger, command output
hashes, evidence JSON hash, repo/cwd/branch/commit context, and current
auditable-worktree fingerprint before treating a command as strong local proof.
Set `STAX_EVIDENCE_ROOT` to override the evidence root for tests or isolated
workspaces.

`stax:collect-visual` stores screenshot/checklist proof in the attached sidecar:

```bash
npm run stax:collect-visual -- --repo ../my-project \
  --path screenshot.png \
  --description "Dashboard card after resize fix" \
  --checklist "text fits" \
  --checklist "mobile layout checked"
```

It can also capture a URL through repo-local Playwright when the target repo has
Playwright available:

```bash
npm run stax:collect-visual -- --repo ../my-project \
  --url http://127.0.0.1:5173/preview \
  --viewport 1280,800 \
  --description "Rendered preview after layout fix"
```

The gate verifies `.stax/visual-proofs/manifest.json`, the screenshot hash, and
the current auditable worktree before using a screenshot as visual proof.

`stax attach` also updates the repo `.gitignore` so the safe durable sidecar
artifacts can be tracked while raw runtime files remain ignored:

```txt
.stax/status.json
.stax/proof_strength.json
.stax/next-codex-prompt.md
.stax/reports/latest-proof-report.md
```

## Validation

Core repo validation:

```bash
npm run validate
```

This is intentionally small:

```txt
typecheck + tests
```

Release and internal gates still exist, but they are not the public product
entry point.

## Compatibility Aliases

These remain to avoid breaking existing local workflows:

```bash
npm run stax:next-prompt -- --repo <path>
npm run rax -- <command>
npm run dev -- <command>
```

## Internal Scripts

Internal, research, campaign, PR-trial, release, and STAX Core scripts remain in
`package.json` for now because GitHub workflows and historical verification
paths still call some of them directly.

The pre-cleanup script surface is archived at:

```txt
docs/archive/package-scripts-legacy.json
```

Do not treat those archived scripts as the product interface.
