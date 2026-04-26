# STAX Chat Interface

STAX chat is the daily front door for the governed runtime.

Use chat for normal work:

```bash
npm run chat
```

Or run one turn:

```bash
npm run rax -- chat --once "Design the next Project Brain phase."
```

After `npm run build` and `npm link`, the package exposes both `rax` and `stax`. The `stax` binary with no arguments opens chat mode.

## What Chat Does

Every normal chat message still goes through:

```txt
RaxRuntime
-> trace
-> LearningEvent
-> queue/proposal when needed
-> thread storage
```

It is chat-first, not chat-only.

Each response includes:

```txt
Run: <run-id>
Mode: <mode>
LearningEvent: <learning-event-id>
Queues: <queues>
Trace: <trace path>
```

## Slash Commands

```txt
/help
/mode auto|planning|learning_unit|project_brain|codex_audit|stax_fitness
/status
/last
/show last
/show <run-id>
/queue
/metrics
/learn last
/lab report
/lab queue
/lab redteam summary
/eval
/regression
/replay last
/thread
/new [title]
/clear
/compact
/state
/prompt <task>
/test-gap <feature>
/policy-drift <change>
/audit-last
/exit
```

Approvals and promotions remain CLI-only in this version. Chat may inspect, evaluate, replay, queue, and propose; it does not promote durable system state.

`/compact` creates a pending thread summary candidate only. It is not approved memory and is not retrieved as durable memory unless reviewed and promoted outside chat.

Learning Lab chat commands expose lab state without promoting candidates. `/lab report`, `/lab queue`, `/lab redteam summary`, `/lab failures`, `/lab patches`, and `/lab handoffs` are read-only. `/lab go cautious 1` may generate and run a cautious lab cycle, but chat cannot approve, promote, merge, or run balanced/aggressive profiles.

## Thread Storage

Threads are stored as JSON:

```txt
chats/threads/<thread-id>.json
```

Each thread stores user/assistant messages, linked run IDs, and linked LearningEvent IDs.

## Limitations

- This is a terminal chat, not a web UI.
- Chat memory remains governed by the existing approved-memory rules.
- Global `stax` is only proven after `npm run build` and `npm link` are run locally.
