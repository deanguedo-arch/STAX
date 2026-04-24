# RAX - Rule-Aware Execution System

RAX is a local TypeScript CLI for repeatable, inspectable LLM orchestration.

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

## Run With Mock Provider

```bash
npm run dev -- "Extract this as signals: Dean trained jiu jitsu Saturday for 90 minutes."
```

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
```

`trace.json` includes routing, boundary, risk, agent sequence, validation, model-call metadata, and retry count.
