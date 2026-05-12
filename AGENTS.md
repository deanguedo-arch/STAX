# AGENTS.md - STAX/RAX Repo Instructions

## Mission

This repo is being upgraded into STAX/RAX: a local rule-aware adaptive assistant runtime.

STAX is the adaptive rule-aware learning/runtime system. RAX is the internal rule-aware runtime name where still used. `stax_fitness` is one explicit optional domain/demo mode, not the product identity. The word `STAX` alone must never route to `stax_fitness`.

Do not build a pile of prompts. The behavior system requires explicit policies, mode detection, risk/boundary filtering, policy compilation, provider routing, schema validation, a critic/repair loop, an eval harness, a corrections loop, replay/trace logs, training-data export, and approved memory only.

## Non-Negotiables

- Preserve existing STAX/RAX functionality.
- Mock provider must work without external APIs.
- Do not require OpenAI key unless provider is `openai`.
- Do not add uncontrolled shell execution.
- Shell execution must remain disabled by default.
- File write tools must remain disabled by default unless config enables them.
- Do not auto-save model outputs to memory.
- Raw model outputs must never auto-save to memory.
- Learning events may be recorded automatically, but memory/eval/training/policy/schema/mode promotion requires explicit approval.
- Learning proposals are evidence, not authority; they must not directly edit durable system state.
- Do not skip evals.
- Do not silently pass schema failures.
- Do not add UI before CLI is stable.
- Corrections must be approved before promotion to eval, memory, or training data.
- Every phase must run typecheck/tests if available.
- Do not claim completion unless commands pass.

## Required Commands

Run after changes:

```bash
npm run typecheck
npm test
```

Also smoke relevant CLI behavior:

```bash
npm run smoke:stax
npm run rax -- eval
```

## Architectural Priority

1. policies
2. modes
3. schemas
4. evals
5. corrections
6. replay/trace
7. runtime
8. agents
9. providers
10. learning loop
11. tools

Agents are not the system.
The feedback loop is the system.

## Approved Agents

Only these agents are approved in v0.1:

- IntakeAgent
- AnalystAgent
- PlannerAgent
- CriticAgent
- FormatterAgent

Do not add recursive agents or free-form agent chat.

<!-- STAX_PROJECT_CONTROL_PROTOCOL_V1 -->
# STAX Project-Control Protocol

You are working under STAX project-control protocol.

At the start of every Codex turn in this repo:

1. Read `.stax/turn-contract.json` if it exists.
2. Read `.stax/status.json` if it exists.
3. If the verdict is `Reject`, `Provisional`, or `Human review`, read `.stax/next-codex-prompt.md` and treat it as the immediate correction task unless the user explicitly says to ignore STAX for this turn.
4. Include the exact `STAX_ACK ...` line from `.stax/turn-contract.json` in `.stax/codex-report.md`.
5. If `.stax/turn-contract.json` is missing, say so in `.stax/codex-report.md` and do not claim completion.
6. If `.stax/task.md` is blank, write the user's current objective there before editing.
7. Before handoff or a protected boundary, run STAX preflight in observer mode unless the user explicitly asks for soft or hard enforcement.

Do not claim completion without proof.
Do not claim tests passed without command output.
Do not broaden scope.
Do not touch deploy, publish, sync, or release paths unless explicitly requested.
Do not treat docs-only changes as implementation proof.
Do not treat script existence as command execution proof.
Do not treat Codex-reported command output as strong local proof.

Before final response, write or update:

```txt
.stax/codex-report.md
```

Required report:

- STAX acknowledgement
- Objective
- Files changed
- Tests added
- Commands run
- Command output summary with exit codes
- What is verified
- What is weak/provisional
- What is unverified
- Risks
- One next action
<!-- /STAX_PROJECT_CONTROL_PROTOCOL_V1 -->
