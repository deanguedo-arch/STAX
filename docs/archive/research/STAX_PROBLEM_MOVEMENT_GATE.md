# STAX Problem Movement Gate

Problem Movement Gate v0 is the control surface that checks whether a Chat
Operator answer actually moves the user's project problem forward.

It sits after the Outcome Header and Operation Receipt are built, and before the
final operator markdown is returned.

It is not a new queue, agent, benchmark, dashboard, promotion path, or scoring
system.

## Purpose

The gate prevents this failure mode:

```txt
nice headings + proof sections + traces != useful answer
```

An operator answer must:

- answer the user task directly
- give exactly one concrete next action
- explain why that action reduces uncertainty
- be honest about proof
- avoid vague work-dumping such as `review the evidence`
- avoid claiming fixed/passed/verified without command, eval, run, or trace
  evidence

## Dispositions

```txt
moved_problem
needs_evidence
human_choice_required
blocked
deferred
failed_to_move
```

`failed_to_move` is a validation failure. The formatter throws instead of
returning a safe-looking but useless answer.

## Hard Fail Rules

The gate fails output when:

- Direct Answer is empty or only says to see the receipt
- One Next Step is missing, generic, or contains multiple primary actions
- One Next Step offers multiple command alternatives
- manual or external command steps do not say what to paste back
- local test/script evidence exists but the answer does not say pass/fail is
  unknown
- local test/script evidence exists but the next step does not name an exact
  test command
- completion-like claims appear without command/eval/run/trace proof
- blocked requests surface a promotion command as the next step
- mutation or promotion status is allowed from chat operator output

## Example

Bad:

```txt
Direct Answer:
See the receipt.

One Next Step:
Review the evidence.
```

Good:

```txt
Direct Answer:
STAX found test/script evidence by read-only inspection, but it did not run
tests; pass/fail is unknown.

One Next Step:
Run `npm test` in the target repo and paste back the full output, exit code if
available, and failing test names if any.
```

## Boundaries

Problem Movement Gate v0 does not:

- run commands
- mutate linked repos
- approve memory
- promote evals
- export training data
- create Project Brain state
- add autonomous execution
- judge external models

It only decides whether the current operator answer is useful enough to return.
