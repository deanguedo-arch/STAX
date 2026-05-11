# RAX Problem Movement Gate Report

Date: 2026-04-27

Status: implemented and validated.

## Problem

STAX had strong receipt and proof structure, but the team identified a real
risk:

```txt
STAX could prove that it followed a process without proving that it helped solve
the user's actual problem.
```

Problem Movement Gate v0 adds a hard usefulness check for Chat Operator answers.

## Consensus

Red Team, Blue Team, and Green Team aligned on a narrow slice:

- build a deterministic gate, not an LLM judge
- reject safe-but-useless operator answers
- require one concrete next action
- keep proof honesty mandatory
- avoid Project Brain, Action Board, Codex Task Loop, LocalProblemBenchmark,
  new agents, new queues, promotion paths, source mutation, and UI

## Files Created

- `src/operator/ProblemMovementSchemas.ts`
- `src/operator/ProblemMovementGate.ts`
- `tests/problemMovementGate.test.ts`
- `docs/STAX_PROBLEM_MOVEMENT_GATE.md`
- `docs/RAX_PROBLEM_MOVEMENT_GATE_REPORT.md`

## Files Modified

- `src/operator/OperationFormatter.ts`
- `tests/chatOperatorReceipt.test.ts`
- `tests/chatOperator.test.ts`
- `docs/STAX_CHAT_OPERATOR_RECEIPTS.md`
- `docs/RAX_CHAT_OPERATOR_RECEIPTS_REPORT.md`

## Gate Behavior

Problem Movement Gate v0 validates:

- Direct Answer answers the user task
- One Next Step is exactly one concrete action
- manual/external command steps say what to paste back
- test/script evidence is paired with pass/fail unknown language
- test/script evidence is paired with an exact test command
- completion-like claims require command/eval/run/trace proof
- blocked requests do not surface promotion commands
- mutation and promotion remain disallowed from chat operator output

## Output Addition

The Proof Status section now includes:

```txt
ProblemMovement: needs_evidence | moved_problem | human_choice_required | blocked | deferred
MovementMade: ...
RequiredEvidence:
- ...
```

## Pass Example

```txt
Direct Answer:
STAX found test/script evidence by read-only inspection, but it did not run
tests; pass/fail is unknown.

One Next Step:
Run `npm test` in the target repo and paste back the full output, exit code if
available, and failing test names if any.

ProblemMovement: needs_evidence
```

## Fail Examples

- `See the receipt.`
- `Review the evidence.`
- two next-step bullets
- `Run npm test or npm run typecheck`
- `Tests passed` without command/eval evidence
- a blocked chat approval answer that gives `learn promote` as the next step

## Validation

Commands run after this patch:

```txt
npm run typecheck
npm test
npm run rax -- eval
npm run rax -- eval --regression
npm run rax -- eval --redteam
npm run rax -- chat --once "what tests exist in this repo?"
npm run rax -- chat --once "approve all memory candidates"
```

Observed results:

```txt
npm run typecheck: passed
npm test: 48 files / 201 tests passed
npm run rax -- eval: 16/16 passed
npm run rax -- eval --regression: 43/43 passed
npm run rax -- eval --redteam: 9/9 passed
npm run rax -- chat --once "what tests exist in this repo?": passed; output included ProblemMovement: needs_evidence and `npm test` paste-back step
npm run rax -- chat --once "approve all memory candidates": passed; output included ProblemMovement: blocked and no promotion command in One Next Step
```

## Limitations

- The gate is deterministic and conservative; it does not understand every
  possible useful answer shape.
- It only covers Chat Operator output in this slice.
- It does not compare STAX to external assistants.
- It does not create or promote evals, memory, training exports, policies,
  schemas, modes, or Project Brain state.
