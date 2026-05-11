# RAX Command Evidence Store Report

## Problem Fixed

STAX could ask for command output and use pasted evidence in the current answer, but that evidence was too chat-local. It could also ask again for proof already supplied, and eval result files could collide when eval commands were run in parallel.

## Implemented

- Pasted command output is parsed into command evidence records.
- Command evidence records include command, status, source, family, counts, workspace, linked repo path, stdout/stderr artifact paths, redaction counts, timestamp, and hash.
- Human-pasted evidence is labeled `human_pasted_command_output`; it is not treated as local execution.
- Chat `/eval` and `/regression` now record command evidence artifacts.
- Workspace audits include stored command evidence and open verification debt.
- Missing full e2e proof becomes verification debt when a linked repo exposes an e2e script and no matching command evidence exists.
- Eval result artifact filenames include a random suffix to avoid parallel write collisions.

## Guardrails

- No linked repo commands are executed by STAX.
- No source mutation path was added.
- No memory, eval, training, policy, schema, or mode promotion path was added.
- Pasted command evidence remains partial unless backed by local execution evidence.

## Remaining Limits

- Full canvas-helper e2e proof is still outstanding until `npm run test:e2e` or the relevant e2e command is actually run and recorded.
- Command output parsing is intentionally narrow and only recognizes common npm/tsx pass-fail summaries.
- Verification debt is command-based, not a full project-state system.

## Validation

Run:

```bash
npm run typecheck
npm test
npm run rax -- eval
npm run rax -- eval --regression
npm run rax -- eval --redteam
```
