# RAX Brightspace Battle Test Report

Date: 2026-04-27

## Purpose

Test whether STAX can compete with an external ChatGPT answer on a real messy repo problem instead of only proving process compliance.

Repo tested:

- `brightspacequizexporter`
- linked workspace: `brightspacequizexporter`
- repo path: `/Users/deanguedo/Documents/GitHub/brightspacequizexporter`

## Prompt

Question:

```txt
What is the biggest current problem/risk, and what is one bounded Codex patch prompt that would move the repo forward?
```

Provided evidence:

- README says the ingest system is under trust repair.
- Reviewed fixtures are truth.
- Parser output and candidate snapshots are not gold.
- `npm run ingest:ci` is the ingest gate.
- package scripts include `test`, `build`, `ingest:ci`, `ingest:promotion-check`, `ingest:check-focused`, `ingest:env-check`, and `ingest:intake-check`.
- tests exist under `src/test`.
- `git status` showed `D tmp/.gitkeep`.
- no test command was run for the prompt.

## External ChatGPT Result

The first external answer drifted back into STAX architecture and did not answer the Brightspace task.

After a stricter Brightspace-only retry, the external answer identified the strongest risk as ingest trust drift:

- reviewed fixtures must remain the truth source
- parser output and candidate snapshots must remain candidate-only
- the bounded proof command should be `npm run ingest:ci`
- relevant files include `scripts/ingest-promotion-check.mjs`, `scripts/config/frozen-manifests.json`, promotion scripts, and ingest tests

## STAX Result Before Patch

STAX was stronger on local proof honesty:

- it resolved the linked workspace
- it inspected repo evidence read-only
- it enumerated package scripts and `src/test`
- it did not claim tests passed
- it surfaced the dirty worktree signal

But STAX's slash prompt path was weaker than the external answer:

- `/prompt For brightspacequizexporter...` used generic STAX internals like `AGENTS.md` and `src/cli.ts`
- it selected generic proof commands instead of the repo-specific ingest gate
- it did not use the README's trust-repair signal to shape the Codex prompt

## Patch Made

Updated:

- `src/chat/ChatSession.ts`
- `src/operator/OperationFormatter.ts`
- `tests/chatOperator.test.ts`

Behavior added:

- `/prompt` now routes named linked-workspace Codex prompt requests through the workspace operator path.
- Prompt candidates use linked repo evidence instead of defaulting to STAX implementation files.
- Brightspace ingest-trust repos prefer `npm run ingest:ci`.
- Brightspace prompt candidates include ingest trust boundary acceptance criteria.
- The outcome header's next step now matches the bounded prompt command.

## Current STAX Behavior

Smoke:

```bash
npm run rax -- chat --once "/prompt For brightspacequizexporter, create one bounded Codex patch prompt based on repo evidence with files to inspect, exactly one command, acceptance criteria, and stop condition."
```

Now starts with:

```txt
## One Next Step
- Run `npm run ingest:ci` in /Users/deanguedo/Documents/GitHub/brightspacequizexporter and paste back the full output, exit code if available, and the Codex final report.
```

And the bounded prompt candidate names:

- `scripts/config/frozen-manifests.json`
- `scripts/ingest-promotion-check.mjs`
- `scripts/promote-corrections-to-benchmark.ts`
- `scripts/promote-ingest-fix.mjs`
- `scripts/seed-ingest-gold-fixtures.ts`
- `src/test/unit/ingest/...`
- `npm run ingest:ci`

## What This Proves

STAX learned from the battle test in a governed way:

- external answer exposed a real STAX weakness
- the weakness became a regression test
- the fix is bounded to workspace prompt generation
- no linked repo files were mutated
- no memory/eval/training/policy/schema/mode promotion happened

## What Is Still Not Proven

- STAX has not yet proven it consistently beats external ChatGPT across many repos.
- STAX has not run `npm run ingest:ci` inside Brightspace.
- The actual Brightspace patch has not been implemented.
- This is one battle-test improvement, not a general LocalProblemBenchmark system.

## Next Useful Battle

Run the same compare loop on:

- `app-admissions`
- `canvas-helper`
- another Brightspace prompt after `npm run ingest:ci` output is available
