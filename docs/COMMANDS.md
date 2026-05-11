# STAX Commands

STAX should feel small from the outside.

The public product surface is:

```bash
npm run stax:attach -- --repo <path>
npm run stax:collect -- --repo <path> -- <command>
npm run stax:gate -- --repo <path>
npm run stax:status -- --repo <path>
npm run stax:next -- --repo <path>
```

The built/installed CLI shape is:

```bash
stax attach --repo <path>
stax collect --repo <path> -- <command>
stax gate --repo <path>
stax status --repo <path>
stax next --repo <path>
```

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
