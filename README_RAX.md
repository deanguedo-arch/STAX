# STAX/RAX - Local Rule-Aware Adaptive Assistant Runtime

STAX/RAX is a local assistant behavior factory. It is not a ChatGPT clone and does not expose or bypass hidden model policies.

It approximates high-quality assistant behavior with explicit local pieces:

```txt
policies -> modes -> risk/boundary -> policy compiler -> provider -> critic -> formatter -> validators -> traces -> evals -> corrections -> training exports
```

## Setup

```bash
npm install
```

## Mock Provider

```bash
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes and slept 8 hours Sunday."
```

## Ollama

PowerShell:

```powershell
$env:RAX_PROVIDER="ollama"; $env:OLLAMA_MODEL="llama3.2"; npm run rax -- run "Analyze these signals."
```

## OpenAI

PowerShell:

```powershell
$env:RAX_PROVIDER="openai"; $env:OPENAI_API_KEY="your_key"; $env:OPENAI_MODEL="gpt-5.2"; npm run rax -- run "Build a plan."
```

OpenAI is optional and is required only when `RAX_PROVIDER=openai`.

## Eval

```bash
npm run rax -- eval
npm run rax -- eval --redteam
npm run rax -- eval --regression
```

## Replay

```bash
npm run rax -- replay <run-id>
```

Mock replay should match exactly. Real providers may drift.

## Correction Loop

```bash
npm run rax -- correct <run-id> --file corrected.md --reason "weak_plan" --errorType weak_plan
npm run rax -- corrections list
npm run rax -- corrections promote <correction-id> --eval --training --golden
```

## Memory

```bash
npm run rax -- memory search "project rule"
npm run rax -- memory list
npm run rax -- memory approve <memory-id>
npm run rax -- memory reject <memory-id>
```

## Training Export

```bash
npm run rax -- train export --sft
npm run rax -- train export --preference
npm run rax -- train export --all
```

## STAX Fitness Example

```bash
npm run rax -- run --mode stax_fitness --file examples/stax_input.txt
```

## Safety And Tool Limits

- Shell is disabled by default.
- File write is disabled by default.
- Memory retrieval is approved-only.
- Corrections are pending until promoted.
- No embeddings or UI are included in v0.1.

## Troubleshooting

- Run `npm run typecheck` for TypeScript issues.
- Run `npm test` for behavior checks.
- Inspect `runs/YYYY-MM-DD/<run-id>/trace.json` for routing and boundary decisions.

## Known Limitations

- Providers beyond mock are adapter-ready but not exercised by default tests.
- Memory retrieval is keyword-based; embeddings are intentionally out of v0.1.
- The evaluator is deterministic and property-based, not a learned judge.
- Tool execution remains deliberately narrow and disabled for writes/shell by default.

## Next Phase

Strengthen evaluator quality and correction review before adding embeddings, UI, or more agents.
