# RAX Chat Interface Report

## Summary

STAX now has a chat-first terminal front door. Normal chat turns still go through the governed runtime, produce run/trace artifacts, record LearningEvents, update learning queues/metrics, and persist linked chat messages.

This is chat-first, not chat-only. CLI commands remain the backend for tests, automation, approvals, and promotions.

## Files Created

- src/chat/ThreadStore.ts
- docs/STAX_CHAT_INTERFACE.md
- docs/RAX_CHAT_INTERFACE_REPORT.md
- chats/.gitkeep

## Files Modified

- .gitignore
- README.md
- docs/CHAT_CLI.md
- package.json
- package-lock.json
- src/chat/ChatSession.ts
- src/cli.ts
- src/core/Replay.ts
- tests/chatSession.test.ts
- tests/replay.test.ts

## Commands Added

- npm run chat
- npm run rax -- chat
- npm run rax -- chat --once "message"
- stax binary alias after build/link

## Slash Commands Added Or Hardened

- /help
- /mode auto|planning|learning_unit|project_brain|codex_audit|stax_fitness
- /last
- /show last
- /show <run-id>
- /queue
- /metrics
- /learn last
- /eval
- /regression
- /replay last
- /thread
- /new [title]
- /exit

Approvals and promotions remain CLI-only.

## Behavior Added

- Normal chat messages call RaxRuntime.run().
- Chat output includes final answer, runId, mode, LearningEvent ID, queue list, and trace path.
- Chat messages persist to chats/threads/<thread-id>.json.
- Thread records link user and assistant messages to run IDs and LearningEvent IDs.
- /queue returns a compact count summary and latest 10 queue items instead of dumping every file.
- /metrics returns a compact learning metric summary.
- /learn last runs learning_unit against the latest chat run.
- /eval and /replay last record command LearningEvents.
- Replay now ignores non-directory entries in runs/ and preserves the original traced mode during replay.

## Tests Added

- Chat thread persistence with linked runId and LearningEvent ID.
- Chat-first slash aliases: /new, /mode, /last, /queue, /metrics, /learn last, /thread.
- Replay ignores stray non-directory entries such as .DS_Store in runs/.
- Replay preserves the original traced mode for explicit-mode runs.

## Verification

```txt
npm run typecheck
Result: passed

npm test
Result: passed
Test Files: 33 passed
Tests: 98 passed

npm run build
Result: passed

npm run rax -- eval
Result: passed
16/16, passRate 1, criticalFailures 0

npm run rax -- eval --regression
Result: passed
25/25, passRate 1, criticalFailures 0
```

## Chat Smoke Output

```txt
npm run rax -- chat --once "/mode auto"
mode: auto

npm run rax -- chat --once "Design the approved learning loop."
Mode: learning_unit
Run: run-2026-04-26T00-58-53-607Z-5kpcai
LearningEvent: learn-2026-04-26T00-58-53-607Z-5kpcai
Queues: trace_only
Trace: runs/2026-04-26/run-2026-04-26T00-58-53-607Z-5kpcai/trace.json
```

## Queue Example

```txt
npm run rax -- chat --once "/queue"

Learning Queue: 293 items
By Type:
- correction_candidate: 15
- eval_candidate: 15
- trace_only: 263

Recent (latest 10):
- [trace_only] learn-2026-04-26T00-58-53-607Z-5kpcai (Run recorded for trace-only learning evidence.)

Use /learn inspect <event-id> for the full event.
```

## Metrics Example

```txt
npm run rax -- chat --once "/metrics"

Learning Metrics:
learningEventsCreated: 278
totalRuns: 274
genericOutputRate: 0
criticFailureRate: 0.054
schemaFailureRate: 0.054
evalFailureRate: 0
candidateApprovalRate: 0
candidateRejectionRate: 0
planningSpecificityScore: 1
```

## Last Run Example

```txt
npm run rax -- chat --once "/last"

Run: run-2026-04-26T00-59-02-364Z-qpzmix
Mode: planning
Validation: passed
LearningEvent: learn-2026-04-26T00-59-02-364Z-qpzmix
LearningQueues: trace_only
Trace: runs/2026-04-26/run-2026-04-26T00-59-02-364Z-qpzmix/trace.json
```

## Learning Unit Example

```txt
npm run rax -- chat --once "/learn last"

Mode: learning_unit
LearningEvent: learn-2026-04-26T00-59-02-924Z-obleb6
Queues: trace_only
Output includes:
- Candidate Queues
- Suggested Eval Candidate
- Suggested Correction Candidate
- Suggested Memory Candidate
- Suggested Policy Patch
- Suggested Schema / Mode Patch
- Approval Required
```

## Replay Example

```txt
npm run rax -- chat --once "/replay last"

Replay: exact
OriginalRun: run-2026-04-26T00-59-02-924Z-obleb6
ReplayRun: run-2026-04-26T01-01-20-905Z-mm8nk4
OutputExact: true
TraceExact: true
Reason: none
```

## Thread Example

```txt
npm run rax -- chat --once "/thread"

Thread: thread_default
Title: STAX Chat
Workspace: default
Mode: planning
Messages: 14
LinkedRuns: 7
LinkedLearningEvents: 7
```

## Documentation Updated

- README.md now documents chat-first use.
- docs/CHAT_CLI.md now describes chat metadata, slash commands, thread storage, and learning controls.
- docs/STAX_CHAT_INTERFACE.md documents the daily chat flow and the governed backend loop.

## Limitations

- This is terminal chat only; no web UI was added.
- Chat approvals/promotions are intentionally not available in v0.1 chat.
- The default thread persists mode across one-shot invocations. Use /mode auto to reset.
- Global stax command is exposed in package metadata but only works after npm run build and npm link.
