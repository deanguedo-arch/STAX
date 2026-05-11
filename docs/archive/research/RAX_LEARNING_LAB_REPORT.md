# RAX Learning Lab Report

## Summary

STAX now has sandboxed Learning Lab Workers. They generate synthetic curricula, scenarios, red-team scenarios, lab runs, candidate artifacts, and lab metrics. They do not create new runtime agents, do not promote durable system updates, do not write approved memory, and do not train models.

The lab loop is:

```txt
curriculum
-> scenarios
-> STAX run
-> LearningEvent
-> lab result
-> candidate artifacts for failures
-> existing approval gate
```

## Files Created

- src/lab/LearningWorker.ts
- src/lab/CurriculumWorker.ts
- src/lab/ScenarioGenerator.ts
- src/lab/RedTeamGenerator.ts
- src/lab/EvalCandidateBuilder.ts
- src/lab/CorrectionCandidateBuilder.ts
- src/lab/DatasetCurator.ts
- src/lab/LabRunner.ts
- src/lab/LabMetrics.ts
- tests/learningLab.test.ts
- docs/STAX_LEARNING_LAB.md
- docs/RAX_LEARNING_LAB_REPORT.md
- learning/lab/**/.gitkeep

## Files Modified

- .gitignore
- README.md
- docs/CHAT_CLI.md
- docs/STAX_CHAT_INTERFACE.md
- src/chat/ChatSession.ts
- src/cli.ts
- src/index.ts

## Tests Added

- Worker result schema validation.
- Invalid worker role rejection.
- Candidate-creating worker requires approval.
- Curriculum generation count, target mode, synthetic flag, candidate state.
- Scenario generation from curriculum.
- Red-team scenario generation with governance risk tags.
- Lab runner creates runs and LearningEvents.
- Failed scenario creates eval, correction, and synthetic training candidates.
- Lab candidates do not enter `training/exports`.
- Lab metrics and read-only chat lab commands.

## Command Results

```txt
npm run typecheck
Result: passed

npm test
Result: passed
Test Files: 34 passed
Tests: 104 passed

npm run rax -- lab curriculum --domain planning --count 5
Result: passed
Output: learning/lab/curricula/planning-2026-04-26T02-11-23-647Z.json

npm run rax -- lab scenarios --curriculum learning/lab/curricula/planning-2026-04-26T02-11-23-647Z.json
Result: passed
Output: learning/lab/scenarios/scenarios-planning-2026-04-26T02-11-31-494Z-d9b6g5.json

npm run rax -- lab run --file learning/lab/scenarios/scenarios-planning-2026-04-26T02-11-31-494Z-d9b6g5.json
Result: passed
5 planning scenarios run, 5 passed, 5 LearningEvents created

npm run rax -- lab redteam --count 5
Result: passed
Output: learning/lab/scenarios/redteam-2026-04-26T02-11-39-814Z.json

npm run rax -- lab run --file learning/lab/scenarios/redteam-2026-04-26T02-11-39-814Z.json
Result: passed
5 red-team scenarios run, 5 passed, 5 LearningEvents created

npm run rax -- lab run --file learning/lab/scenarios/forced-failure-smoke.json
Result: passed
1 forced failure run, 1 failed as expected, 3 lab candidates created

npm run rax -- lab queue
Result: passed
Lab Candidates: 3

npm run rax -- lab report
Result: passed
scenariosGenerated: 11
scenariosRun: 11
passRate: 0.909
candidatesCreated: 3

npm run rax -- eval
Result: passed
16/16, passRate 1, criticalFailures 0

npm run rax -- eval --regression
Result: passed
25/25, passRate 1, criticalFailures 0
```

## Sample Curriculum

```json
{
  "domain": "planning",
  "targetMode": "planning",
  "synthetic": true,
  "approvalState": "candidate",
  "expectedProperties": [],
  "forbiddenPatterns": [
    "confirm requirements",
    "define next steps",
    "ensure quality"
  ]
}
```

## Sample Scenario

```json
{
  "id": "scenarios-planning-...-scenario-001",
  "mode": "planning",
  "input": "Design a bounded implementation plan for a system improvement...",
  "requiredSections": [
    "## Objective",
    "## Tests / Evals To Add",
    "## Commands To Run",
    "## Evidence Required",
    "## Codex Prompt"
  ],
  "synthetic": true,
  "approvalState": "candidate"
}
```

## Sample Lab Run

```json
{
  "scenarioId": "forced-failure-smoke-001",
  "runId": "run-2026-04-26T02-12-26-114Z-5nfd1a",
  "learningEventId": "learn-2026-04-26T02-12-26-114Z-5nfd1a",
  "pass": false,
  "failReasons": [
    "missing required section: ## Impossible Lab Smoke Section"
  ],
  "queuesCreated": [
    "trace_only",
    "learning/lab/candidates/eval/lab-eval-forced-failure-smoke-001-...",
    "learning/lab/candidates/correction/lab-correction-forced-failure-smoke-001-...",
    "learning/lab/candidates/training/lab-training-forced-failure-smoke-001-..."
  ]
}
```

## Sample Candidates

Failed lab scenarios create candidate artifacts only:

```txt
learning/lab/candidates/eval/
learning/lab/candidates/correction/
learning/lab/candidates/training/
learning/lab/candidates/memory/
```

Candidate artifacts include:

```json
{
  "synthetic": true,
  "approvalState": "candidate",
  "requiresApproval": true,
  "sourceScenarioId": "forced-failure-smoke-001",
  "runId": "run-...",
  "learningEventId": "learn-..."
}
```

No lab candidate is promoted into `evals/`, `memory/approved/`, `training/exports/`, `goldens/`, policies, schemas, or modes.

## Lab Metrics

```json
{
  "scenariosGenerated": 11,
  "scenariosRun": 11,
  "passRate": 0.909,
  "failureTypes": {
    "missing required section": 1
  },
  "candidatesCreated": 3,
  "approvalRate": 0,
  "repeatedFailures": 0,
  "redteamPassRate": 1
}
```

## Chat Integration

Read-only chat commands were added:

```txt
/lab report
/lab queue
/lab redteam summary
```

They expose lab state only. They do not approve or promote candidates.

## Approval Boundaries

Learning Lab Workers may create candidates. They may not:

- promote candidates
- approve memory
- write approved memory
- edit policies
- edit schemas
- edit modes
- export training data
- train or fine-tune models
- treat synthetic scenarios as real truth

## Limitations

- The lab currently uses deterministic scenario checks.
- Model-based judging was intentionally not added.
- Lab candidates are separate from existing promotion commands until reviewed.
- Generated lab artifacts are ignored by git except `.gitkeep` placeholders.
