# AGENTS.md - STAX/RAX Repo Instructions

## Mission

This repo is being upgraded into STAX/RAX: a local rule-aware adaptive assistant runtime.

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
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
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
10. tools

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
