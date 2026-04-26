# Chat CLI

`rax chat` is the chat-first terminal shell around the existing governed runtime. It does not bypass policy compilation, risk checks, schema validation, critic gates, run logging, LearningEvent recording, or approved-memory rules.

## Start Interactive Chat

```bash
npm run chat
npm run rax -- chat
```

## Smoke One Turn

```bash
npm run rax -- chat --once "what are we doing next?"
```

Every normal chat response prints the answer plus:

```txt
Run: <run-id>
Mode: <mode>
LearningEvent: <learning-event-id>
Queues: <learning queues>
Trace: <trace path>
```

## Commands

```txt
/help
/mode auto|<mode>
/project <name>
/status
/last
/show last|<run-id>
/queue
/metrics
/learn last
/lab report
/lab queue
/lab redteam summary
/eval
/regression
/replay last|<run-id>
/thread
/new [title]
/clear
/compact
/memory search <query>
/remember <fact>
/state
/prompt <task>
/test-gap <feature>
/policy-drift <change>
/audit-last
/runs
/exit
```

## Control Surface Commands

- `/state` runs Project Brain with local read-only evidence: project docs, latest eval result, latest run folder, and mode maturity.
- `/prompt <task>` runs Prompt Factory.
- `/test-gap <feature>` runs Test Gap Audit.
- `/policy-drift <change>` runs Policy Drift.
- `/audit-last` sends the previous assistant output through Codex Audit.
- `/learn last` runs Learning Unit against the latest chat run.
- `/queue` and `/metrics` summarize learning state without opening files.
- `/eval`, `/regression`, and `/replay last` keep test/replay checks inside chat while still recording command LearningEvents.
- `/status` shows workspace, thread, mode, latest run, latest LearningEvent, queue counts, and learning metrics.
- `/clear` clears only the active context window. It keeps thread history, runs, traces, and LearningEvents.
- `/compact` writes a thread summary candidate under `chats/summary_candidates/` and requires review before any memory promotion.
- `/lab report`, `/lab queue`, `/lab redteam summary`, `/lab failures`, `/lab patches`, and `/lab handoffs` are Learning Lab views. `/lab go cautious 1` may generate a cautious lab cycle. Chat does not approve, promote, merge, or run balanced/aggressive lab profiles.

## Threads

Chat threads are stored under:

```txt
chats/threads/<thread-id>.json
```

Threads store messages, linked run IDs, and linked LearningEvent IDs. `/new` starts a fresh thread; `/thread` shows the current thread state.

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
