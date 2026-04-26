# STAX/RAX - Rule-Aware Adaptive Runtime

STAX is the adaptive rule-aware learning/runtime system. RAX is the internal runtime engine/name where still used. `stax_fitness` is one explicit optional domain mode, not the product identity.

It processes input through:

```txt
Input
-> Risk Classifier
-> Boundary Decision
-> Instruction Stack
-> Retrieval
-> Agent Router
-> Primary Agent
-> Critic Agent
-> Formatter Agent
-> Schema Validation
-> Run Log
-> LearningEvent
-> Learning Queue / Proposal / Approval Gate
-> Output
```

## Install

```bash
npm install
cp .env.example .env
```

On PowerShell:

```powershell
Copy-Item .env.example .env
```

## Chat-First Use

For daily use, start STAX chat:

```bash
npm run chat
```

One-shot chat for tests or quick prompts:

```bash
npm run rax -- chat --once "Design the approved learning loop."
```

Normal chat messages still create a run, trace, LearningEvent, queue/proposal when needed, and a linked thread message under `chats/threads/`.

Useful slash commands:

```txt
/mode planning
/status
/last
/queue
/metrics
/learn last
/lab report
/lab queue
/eval
/replay last
/clear
/compact
/exit
```

You can also use plain English for common controls:

```txt
what just happened?
show status
learn from that
audit last answer
run evals
unleash the sandbox
show sandbox report
reset mode to auto
```

## Learning Lab Workers

The Learning Lab creates synthetic scenario candidates for controlled STAX exposure. Workers are not autonomous agents and do not promote memory, evals, training records, policies, schemas, or modes.

```bash
npm run rax -- lab curriculum --domain planning --count 5
npm run rax -- lab scenarios --curriculum learning/lab/curricula/<file>.json
npm run rax -- lab run --file learning/lab/scenarios/<file>.json
npm run rax -- lab redteam --count 5
npm run rax -- lab report
npm run rax -- lab queue
```

Profile-bound improvement cycles are available as sandbox artifacts:

```bash
npm run rax -- lab go --profile cautious --cycles 1 --domain planning --count 5
npm run rax -- lab go --profile balanced --cycles 1 --domain planning --count 5
npm run rax -- lab failures
npm run rax -- lab patches
npm run rax -- lab handoffs
```

These commands can create cycle records, failure clusters, patch proposals, handoff prompts, verification records, and release-gate records. They do not merge, promote, approve memory, train models, or mutate durable system state automatically.

## Run With Mock Provider

```bash
npm run dev -- run --mode planning "Design the STAX approved learning loop."
```

The mock provider works offline. OpenAI is required only when `RAX_PROVIDER=openai`.

## Run With Ollama

```bash
RAX_PROVIDER=ollama OLLAMA_MODEL=llama3.2 npm run dev -- "Analyze this project plan."
```

On PowerShell:

```powershell
$env:RAX_PROVIDER="ollama"; $env:OLLAMA_MODEL="llama3.2"; npm run dev -- "Analyze this project plan."
```

## Run With OpenAI

```bash
RAX_PROVIDER=openai OPENAI_API_KEY=your_key OPENAI_MODEL=gpt-5.2 npm run dev -- "Build a project plan."
```

OpenAI is optional. `OPENAI_API_KEY` is required only when `RAX_PROVIDER=openai`.

## Commands

```bash
npm run dev -- run "input"
npm run dev -- run --file input.txt
npm run dev -- batch examples/
npm run dev -- eval
npm run dev -- replay <run-id>
npm run dev -- show last
npm run dev -- learn queue
npm run dev -- learn metrics
npm run dev -- memory search "query"
npm run dev -- correct <run-id> --output corrected.md --reason "reason"
```

## Test

```bash
npm test
npm run typecheck
```

## Run Logs

Each run writes:

```txt
runs/YYYY-MM-DD/<run-id>/
  input.txt
  config.json
  stack.md
  risk.json
  routing.json
  agent-output.md
  critic.md
  final.md
  trace.json
  learning_event.json
```

`trace.json` includes routing, boundary, risk, agent sequence, validation, model-call metadata, and retry count.

## Domain Compatibility

`stax_fitness` remains available only as an explicit domain mode:

```bash
npm run dev -- run --mode stax_fitness "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
```
