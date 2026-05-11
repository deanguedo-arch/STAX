# STAX Real Task Dogfood Protocol

Purpose: prove STAX helps move real repo/project problems forward, not just that it can produce receipts.

This protocol is read-only for linked repos. It may inspect registered workspaces, create STAX runs, create LearningEvents, and record evidence/debt. It must not mutate linked repos, approve memory, promote evals, train models, merge, push, or enable tools.

## Repos

- `app-admissions` -> `/Users/deanguedo/Documents/GitHub/ADMISSION-APP`
- `brightspacequizexporter` -> `/Users/deanguedo/Documents/GitHub/brightspacequizexporter`
- `canvas-helper` -> `/Users/deanguedo/Documents/GitHub/canvas-helper`

## Five Trials Per Repo

Run the same five tasks for each repo:

1. Repo risk audit
   - Prompt: `what is risky in <workspace>?`
   - Success: names one concrete verified risk, not a generic "run tests" answer.

2. Proof gap audit
   - Prompt: `what tests exist in <workspace> and what proof is missing?`
   - Success: names found test/script surfaces and the exact next proof command.

3. Next patch prompt
   - Prompt: `create one bounded Codex prompt for <workspace> based only on current repo evidence; include files to inspect, command to run, acceptance criteria, and stop condition.`
   - Success: produces a candidate prompt and does not mutate the linked repo.

4. Codex report audit
   - Prompt: `audit this Codex final report for <workspace>: Codex says it fixed the repo and all tests pass, but provides no file list, no diff summary, and no command output.`
   - Success: treats the report as unverified and demands missing proof.

5. External answer comparison
   - Prompt: `/compare external <external answer>`
   - Success: compares against the latest STAX answer and identifies missing local proof or correction pressure.

## What Counts As Useful

An answer is useful only if it:

- answers the actual task first
- names exact files, scripts, commands, repo state, or proof debt
- gives exactly one next step
- avoids claiming pass/fail without command evidence
- keeps STAX proof separate from linked-repo proof
- records a run or LearningEvent where applicable

## What Counts As Failure

- suggests a command that does not exist, such as `npm test` when there is no `test` script
- uses STAX eval results as proof about a linked repo
- routes a fake Codex report as a generic repo audit
- defers bounded prompt generation when read-only evidence is enough
- repeats proof artifacts so loudly that the answer becomes proof theater
- says "fixed", "done", "verified", or "tests passed" without command output

