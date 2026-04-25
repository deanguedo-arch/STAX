# Chat CLI

`rax chat` is a terminal chat shell around the existing governed runtime. It does not bypass policy compilation, risk checks, schema validation, critic gates, run logging, or approved-memory rules.

## Start Interactive Chat

```bash
npm run rax -- chat
```

## Smoke One Turn

```bash
npm run rax -- chat --once "what are we doing next?"
```

## Commands

```txt
/help
/mode auto|<mode>
/project <name>
/memory search <query>
/remember <fact>
/state
/prompt <task>
/test-gap <feature>
/policy-drift <change>
/audit-last
/runs
/quit
```

## Control Surface Commands

- `/state` runs Project Brain with local read-only evidence: project docs, latest eval result, latest run folder, and mode maturity.
- `/prompt <task>` runs Prompt Factory.
- `/test-gap <feature>` runs Test Gap Audit.
- `/policy-drift <change>` runs Policy Drift.
- `/audit-last` sends the previous assistant output through Codex Audit.

## Memory Rule

`/remember` creates pending project memory with `approved: false`. It will not be retrieved until approved with:

```bash
npm run rax -- memory approve <id>
```

## Local Codex Audit

For a report file, run:

```bash
npm run rax -- codex-audit-local --report report.md
```

This collects read-only local evidence with controlled git commands, latest eval result lookup, latest run folder lookup, and mode maturity. It does not enable arbitrary shell execution or file writes.
