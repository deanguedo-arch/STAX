# STAX Strategic Deliberation

## Purpose

Strategic Deliberation is the first STAX layer aimed at broad reasoning, not
only local repo proof. It exists because reliability gates do not automatically
create better product judgment, creative planning, or ambiguous strategic
reasoning.

## Use

```bash
npm run rax -- run --mode strategic_deliberation "How should STAX become better than ChatGPT at broad reasoning?"
npm run rax -- strategy benchmark
npm run rax -- strategy prompt
```

In chat:

```txt
/strategy How should STAX become better than ChatGPT at broad reasoning?
```

## Contract

Strategic output must include:

- multiple options
- one selected best option
- rejected alternatives
- red-team failure modes
- opportunity cost
- reversibility
- evidence used
- evidence missing
- one executable next proof step
- kill criteria
- provider capability warning when capability is weak or unknown

## Hard Failures

The validator rejects:

- one-option strategy
- roadmap-only output
- no rejected alternatives
- no opportunity cost
- no reversibility
- no kill criteria
- high confidence while evidence is missing
- no provider capability warning or strong-provider status

## Provider Rule

If the provider is `mock`, STAX must treat strategic output as draft strategy.
If the provider is local/unknown, STAX must require strong external comparison.
Even with a strong provider, strategic superiority still requires benchmark
proof.

## Benchmark

`StrategicBenchmark` scores STAX versus an external baseline on:

- option quality
- decision clarity
- tradeoff clarity
- red-team depth
- evidence discipline
- next proof step
- kill criteria
- provider honesty

The benchmark does not declare broad reasoning superiority unless enough clean
strategic comparisons pass across multiple work lanes and dates.

## Guardrails

- No hidden prompt extraction.
- No self-approval.
- No memory/eval/training/policy/schema/mode auto-promotion.
- No linked repo mutation.
- No broad superiority claim from one strategic slice.
