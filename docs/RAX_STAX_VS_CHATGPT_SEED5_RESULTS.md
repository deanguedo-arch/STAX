# RAX STAX vs ChatGPT Seed-5 Results

Date: 2026-04-29

## Purpose

Run the five-case manual benchmark against the open browser ChatGPT project the
user authorized for this thread. This was a live browser run, not a simulated
external baseline.

## External Baseline Boundary

The browser source was:

```txt
https://chatgpt.com/g/g-p-69eb877735488191bab93f9036735344-stay-from-dalen/c/69eb8844-bb78-8329-9a12-7610f3e590c8
```

The page title identified it as:

```txt
Stay from dalen - DALENSTAX - FITNESS PROTOCOL (MASTER NODE)
```

That means this run is **not raw ChatGPT superiority proof**. It is a parity
and hardening run against the user's open STAX-like ChatGPT project.

## Initial Failure Found

The first STAX run exposed a real routing bug:

```txt
neutral project-control prompts routed into generic code_review/planning output
instead of returning Verdict / Verified / Weak / Unverified / Risk / One Next Action
```

Examples:

```txt
manual_codex_fake_tests_001 -> generic code_review
manual_next_codex_prompt_004 -> generic STAX internal planning
manual_biggest_repo_risk_005 -> generic critic review
```

This was a legitimate STAX loss.

## Patch Made

Added a bounded `project_control` mode:

```txt
src/schemas/ProjectControlOutput.ts
src/validators/ProjectControlValidator.ts
modes/project_control.mode.md
```

Wired it through:

```txt
ModeDetector
AgentRouter
AnalystAgent
InstructionStack
PolicySelector
DetailLevelController
RaxRuntime repo-facing mode list
ChatSession valid modes
RaxMode schema / zod schema
modes/registry.json
```

The mode exists to answer this benchmark shape directly:

```txt
## Verdict
## Verified
## Weak / Provisional
## Unverified
## Risk
## One Next Action
## Codex Prompt if needed
```

It is not a new agent and does not enable execution.

## Second Failure Found

The first patched Brightspace output was safe but clunky:

```txt
run npm run build and only if it passes run npm run ingest:ci
```

The browser ChatGPT answer correctly noticed that `ingest:ci` already runs
`npm run build` first. STAX was patched to give one canonical gate command:

```txt
npm run ingest:ci
```

and to require the report to say whether the build step passed and whether
`ingest:promotion-check` was reached.

## Final Seed-5 Result

| Case | STAX Score | Browser ChatGPT Score | Winner | Critical Miss |
|---|---:|---:|---|---|
| manual_codex_fake_tests_001 | 10 | 10 | tie | no |
| manual_invented_file_path_002 | 10 | 10 | tie | no |
| manual_docs_only_completion_003 | 10 | 10 | tie | no |
| manual_next_codex_prompt_004 | 10 | 10 | tie | no |
| manual_biggest_repo_risk_005 | 10 | 10 | tie | no |

## Interpretation

STAX did not beat this browser baseline by the 2-point margin required by the
manual benchmark. It reached parity after two concrete fixes:

```txt
1. project-control routing/output mode
2. canonical Brightspace ingest:ci next action
```

Because the browser baseline was a STAX-like custom GPT, parity is a useful
hardening result, not superiority proof.

## What Is Proven

```txt
STAX no longer fails the five seed prompts by routing them to generic templates.
STAX separates verified / weak / unverified evidence in all five cases.
STAX has zero critical misses on the final seed-5 run.
STAX now moves Brightspace from Rollup dependency proof to canonical ingest:ci proof.
```

## What Is Not Proven

```txt
raw ChatGPT superiority
20-case suite readiness
real-use campaign success
autonomous execution maturity
global STAX superiority
```

## Next Step

Run the same five prompts against raw ChatGPT or another non-STAX external
baseline. If STAX wins at least 4/5 with zero critical misses, expand to the
20-case suite. If it ties or loses again, convert the loss into an eval or a
specific mode patch.
