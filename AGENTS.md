# AGENTS.md - RAX Project Instructions

## Project Purpose

This repository builds RAX: a local Rule-Aware Execution System for LLM orchestration.

RAX wraps model calls with instruction hierarchy, risk classification, boundary decisions, local memory, agent routing, critic review, formatter enforcement, strict schema validation, trace logging, evals, corrections, and replay.

## Engineering Rules

- Use TypeScript.
- Use strict types.
- Keep modules small.
- Do not add unnecessary frameworks.
- Mock model calls first.
- Keep provider adapters replaceable.
- Do not hardwire OpenAI only.
- Ensure the project runs locally with mock provider.
- Add tests for routing, risk, boundary decisions, providers, runtime flow, schema validation, evals, replay, and corrections.

## Required Commands

After changes, run:

```bash
npm run typecheck
npm test
```

## Architecture Constraints

- Every agent must implement `Agent`.
- Every model provider must implement `ModelProvider`.
- Normal output must pass through `CriticAgent`, `FormatterAgent`, and schema validation.
- `BoundaryDecision` must run before model calls.
- Refused requests must not call the model provider.
- `RunLogger` must save inspectable run folders under `runs/YYYY-MM-DD/<run-id>/`.
- Prompt, schema, runtime version, determinism controls, routing, and model-call trace must be logged.

## Safety Constraints

- RAX must not provide actionable harm.
- RAX must not help identify private people.
- RAX must not bypass provider rules.
- RAX must not claim hidden capabilities.
- RAX must not silently execute shell commands.
- Shell and file-write tools are disabled by default.

## Done Criteria

A task is not done unless:

- TypeScript compiles.
- Tests pass.
- CLI runs with mock provider.
- README instructions work.
- New behavior has tests where practical.
