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

The target installed CLI shape is:

```bash
stax attach --repo <path>
stax collect --repo <path> -- <command>
stax gate --repo <path>
stax status --repo <path>
stax next --repo <path>
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
