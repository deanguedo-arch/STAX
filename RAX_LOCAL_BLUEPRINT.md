# RAX Local Blueprint

This file records the approved local build blueprint for RAX: a Rule-Aware Execution System.

## Purpose

RAX is a local TypeScript project that wraps model calls with explicit rules, safety boundaries, instruction hierarchy, agent routing, structured memory, critic review, formatter enforcement, strict output schemas, run logging, evaluation, correction, replay, and provider adapters.

RAX is not a replacement for ChatGPT. It is a local orchestration layer.

## MVP Flow

```txt
User Input
-> RiskClassifier
-> BoundaryDecision
-> InstructionStack
-> Context Retrieval
-> AgentRouter
-> PrimaryAgent
-> CriticAgent
-> FormatterAgent
-> Schema Validation
-> RunLogger
-> Final Output
```

If the boundary decision is `refuse` or `redirect`, RAX must not call the model provider.

## Provider Modes

- `mock`: deterministic local placeholder provider.
- `ollama`: local model execution through `/api/generate` with `stream: false`.
- `openai`: optional remote model execution through the OpenAI SDK.

OpenAI must remain optional. The app must not require `OPENAI_API_KEY` unless `RAX_PROVIDER=openai`.

## Non-Negotiable Additions

- Determinism controls: `seed`, `temperature`, `top_p`, provider, model, and max tokens.
- Trace tree: instruction stack, routing decision, agent sequence, risk score, boundary decision, model calls, latency, validation, retries.
- Agent limits: max agents, max tokens per run, max critic passes, timeout.
- Drift detection: `evals/cases/`, `evals/expected/`, and `goldens/`.
- Strict schemas: validate output or retry once, then fail explicitly.
- Failure recovery: provider retry foundation, schema retry once, critic failure visible.
- Mode locking: intake, analysis, planning, audit, and STAX fitness behavior contracts.
- Anti-hallucination checks: critic flags unsupported interpretation and new-entity drift.
- Batch processing: process a folder through normal run logging.
- Versioning: prompt, schema, and runtime versions logged per run.

## Agent Set

Only implement these agents for the MVP:

- IntakeAgent
- AnalystAgent
- PlannerAgent
- CriticAgent
- FormatterAgent

No uncontrolled multi-agent fan-out in the first build.

## CLI Commands

```txt
rax run "..."
rax run --file input.txt
rax batch folder/
rax eval
rax replay <run-id>
rax memory search "..."
rax correct <run-id>
```

## Success Criteria

```bash
npm install
npm run typecheck
npm test
npm run dev -- "Extract this as signals: Dean trained jiu jitsu Saturday for 90 minutes."
```

Expected behavior:

- CLI accepts input.
- Risk score is low.
- Router selects IntakeAgent or STAX fitness mode.
- Mock provider is called for primary, critic, and formatter.
- Schema validation passes.
- Run log folder is saved.
- Final output prints.
