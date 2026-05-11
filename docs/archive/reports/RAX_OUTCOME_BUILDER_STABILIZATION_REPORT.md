# RAX Outcome Builder Stabilization Report

Date: 2026-04-28

## Purpose

The operator formatter decomposition reduced central complexity, but it moved
the highest-branching behavior into `DirectAnswerBuilder`, `NextStepBuilder`,
and the operator adapters. This pass freezes new gate work and adds focused
coverage around those components so future wiring changes do not create new
God files.

## Review Packet

### Red Team

- Risk: `DirectAnswerBuilder` could start making proof claims that
  `NextStepBuilder` does not close with an exact evidence step.
- Risk: `NextStepBuilder` could route around failed command evidence by falling
  back to generic `npm test` instructions.
- Risk: visual, judgment, and evidence-request logic could be duplicated inside
  builders instead of staying in adapters.
- Risk: dependency repair blockers could become implicit permission to run
  install/delete commands.

### Blue Team

- Smallest safe patch: add focused unit tests only; do not change runtime
  behavior, schemas, superiority gates, or execution permissions.
- Cover direct answer cases for static test evidence, failed commands, rendered
  preview proof, and judgment digest output.
- Cover next-step cases for proof commands, dependency inspection, visual proof,
  and low-evidence fallback.
- Add adapter tests for failed command evidence, dependency blockers, visual
  protocol output, judgment packets, command selection, and evidence requests.
- Add a static no-duplicate-branching audit that ensures builders share adapter
  functions instead of constructing protocol builders directly.

### Green Team

- The value is maintainability: Dean can keep adding governed behavior without
  turning the live answer path into an untestable conditional maze.
- The report is decision-useful because it states what is now covered and what
  is explicitly not being built.
- This pass improves confidence in operator usefulness but does not claim broad
  superiority or autonomous execution.

### Consensus

- Decision: keep.
- Patch type: test/report stabilization.
- Proof impact: improves regression protection for the live operator path;
  does not advance global superiority proof.
- Execution impact: none.
- Do-not-build list: no new gates, no execution lane activation, no linked repo
  mutation, no shell/file-write enablement, no approvals, no promotions.

## Added Coverage

`tests/operatorOutcomeBuilders.test.ts` adds focused checks for:

- `DirectAnswerBuilder`
  - static test/script evidence remains partial;
  - failed command evidence overrides fake all-tests-pass claims;
  - rendered-preview claims remain visually unverified;
  - judgment digests render approval-required packet summaries.
- `NextStepBuilder`
  - static tests lead to one exact command and paste-back instruction;
  - failed command/dependency blockers stay ahead of generic test commands;
  - completed dependency inspection moves to a human approval boundary;
  - visual claims ask for screenshots/findings instead of runtime commands;
  - low-evidence tasks use `EvidenceRequestBuilder`.
- adapters
  - failed command extraction;
  - dependency repair blocker and completed inspection detection;
  - visual proof protocol scoping;
  - judgment packet recommendations without action;
  - proof command selection that avoids repeated command evidence;
  - task-specific evidence fallback.
- no-duplicate-branching audit
  - shared proof-boundary functions remain in `OperatorEvidenceAdapters`;
  - builders do not instantiate `VisualEvidenceProtocol`,
    `EvidenceRequestBuilder`, or `JudgmentPacketBuilder` directly.

## Guardrails Preserved

- No linked repo mutation.
- No shell/file-write enablement.
- No auto-promotion.
- No new durable agents.
- No execution lane activation.
- Existing formatter, receipt, problem-movement, eval, benchmark, and redteam
  validation still apply.

## Validation

Commands run:

```bash
npm test -- --run tests/operatorOutcomeBuilders.test.ts
npm run typecheck
npm test
npm run rax -- eval
npm run rax -- eval --regression
npm run rax -- eval --redteam
npm run rax -- compare benchmark --file fixtures/problem_benchmark/fresh_holdout_25_tasks.json
npm run rax -- compare adversary --file fixtures/problem_benchmark/fresh_holdout_25_tasks.json
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
```

Results:

- Focused builder/adapter tests: 1 file, 16 tests passed.
- Full test suite: 67 files, 338 tests passed.
- Main eval: 16/16 passed.
- Regression eval: 47/47 passed.
- Redteam eval: 9/9 passed.
- Fresh holdout benchmark smoke: 25/25 `stax_better`; status remains
  `slice_only`.
- Benchmark adversary smoke: 25/25 passed; stuffed/generic/fake-evidence
  answers did not beat clean useful answers.
- STAX fitness smoke: passed with a run artifact under `runs/2026-04-28/`.
