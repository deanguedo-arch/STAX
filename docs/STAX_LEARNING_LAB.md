# STAX Learning Lab

The STAX Learning Lab is a sandbox for controlled exposure. It creates synthetic curricula, scenarios, red-team cases, lab runs, and candidate improvements. It does not train STAX directly and it does not modify durable system state.

## Why Workers, Not Agents

The repo's approved runtime agents remain limited to the core runtime agents. Learning Lab components are workers because they generate bounded artifacts and reports. They do not roam, approve, patch, or promote.

Use this language:

```txt
Learning Lab Workers
```

Do not call them subagents, autonomous agents, or training agents.

## What Workers Can Do

- Generate synthetic curriculum candidates.
- Generate runnable synthetic scenarios.
- Generate governance red-team scenarios.
- Run scenarios through RaxRuntime.
- Create normal runs, traces, and LearningEvents through the existing runtime.
- Evaluate outputs against deterministic scenario expectations.
- Create candidate eval, correction, training, and memory artifacts under `learning/lab/candidates/`.
- Write lab reports and metrics.

## What Workers Cannot Do

- Promote candidates.
- Approve memory.
- Write approved memory.
- Edit policies, schemas, modes, AGENTS.md, or config.
- Export lab candidates directly to training exports.
- Train or fine-tune models.
- Run uncontrolled shell commands.
- Treat synthetic data as real user/project truth.

## Synthetic Data Warning

All Learning Lab artifacts are synthetic by default:

```json
{
  "synthetic": true,
  "approvalState": "candidate"
}
```

Synthetic data may become eval, correction, memory, or training material only through the existing approval flow.

## Commands

Generate a curriculum:

```bash
npm run rax -- lab curriculum --domain planning --count 5
```

Generate scenarios from a curriculum:

```bash
npm run rax -- lab scenarios --curriculum learning/lab/curricula/<file>.json
```

Run scenarios through STAX:

```bash
npm run rax -- lab run --file learning/lab/scenarios/<file>.json
```

Generate red-team scenarios:

```bash
npm run rax -- lab redteam --count 5
```

Show report and candidates:

```bash
npm run rax -- lab report
npm run rax -- lab queue
```

## Chat Commands

These are read-only:

```txt
/lab report
/lab queue
/lab redteam summary
```

No chat command approves or promotes Learning Lab candidates.

## Storage

```txt
learning/lab/curricula/
learning/lab/scenarios/
learning/lab/runs/
learning/lab/reports/
learning/lab/candidates/eval/
learning/lab/candidates/correction/
learning/lab/candidates/training/
learning/lab/candidates/memory/
```

Generated lab artifacts are intentionally ignored by git except `.gitkeep` placeholders.

## Approval Flow

```txt
curriculum
-> scenarios
-> STAX run
-> LearningEvent
-> lab result
-> candidate artifacts
-> existing approval gate
```

The Learning Lab creates learning pressure. It does not decide what becomes durable system behavior.

## Limitations

- The first implementation uses deterministic checks only.
- Model-based judging is intentionally not added yet.
- Lab candidates are not wired into automatic promotion commands.
- Generated scenarios are synthetic and may be useful as eval candidates only after review.
