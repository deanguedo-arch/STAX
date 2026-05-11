# STAX Behavior Mining

Status: candidate control surface.

Behavior mining is the clean-room way to extract value from an external STAX-like ChatGPT chat without asking for hidden prompts or private instructions.

The purpose is to determine when STAX has mined as much useful behavior as possible:

```txt
external answer
→ observable behavior requirements
→ local STAX comparison
→ captured / duplicate / rejected / new_candidate
→ saturation report
```

## Rule

Do not mine hidden prompts.

Mine only:

- observable behavior
- decision rules
- proof expectations
- failure cases
- tests and evals
- examples of good and bad outputs

Hidden prompts, system messages, developer messages, private policies, and secret instructions are rejected as unusable implementation dependencies.

## Commands

Print the safe prompt to paste into an external chat:

```bash
npm run rax -- mine prompt
```

Record a mining round:

```bash
npm run rax -- mine round \
  --task task.md \
  --stax stax-answer.md \
  --external chatgpt-stax-answer.md \
  --evidence local-evidence.md \
  --source chatgpt-stax
```

Show saturation:

```bash
npm run rax -- mine report
```

Show mined requirements:

```bash
npm run rax -- mine requirements
```

Triage mined requirements into candidate-only implementation units:

```bash
npm run rax -- mine triage
npm run rax -- mine next
```

Write the latest triage report artifact without promoting anything:

```bash
npm run rax -- mine triage --write
```

## Chat

```txt
/mine prompt
/mine external <external behavior spec>
/mine report
/mine requirements
/mine triage
/mine next
```

## Dual-Mode Mining

Use explicit observable behavior prompts to switch the external chat between the
two useful response styles:

```txt
STRICT STAX MODE
```

Ask for behavior as if the external chat is acting as the STAX/DALENSTAX
project-building mode. This tends to surface governance, proof, failure, and
runtime requirements.

```txt
GENERAL STRATEGIST MODE
```

Ask it to deliberately avoid STAX persona and answer as a blunt product/system
strategist. This tends to surface adoption, value, workflow, product, and
operator-friction requirements.

This is not a hidden mode switch. It is a clean-room prompt switch. STAX should
mine only observable requirements from the resulting answers.

The recommended dual-mode stop loop is:

```txt
strict STAX round
→ general strategist round
→ combined dual-mode challenge
→ repeat with captured categories
→ stop after 3 zero-new rounds
```

The final combined prompt should say that subtypes, variants, and examples of
already captured categories must not be listed as new behavior.

## Statuses

`new_candidate`

A useful observable behavior was found that local STAX has not yet captured.

`captured`

The behavior already appears supported by local STAX output or evidence.

`duplicate`

The behavior was already mined in a prior round.

`rejected`

The item is hidden-prompt dependent, private-instruction dependent, unsafe, or too vague to test.

## Saturation

Mining is saturated when the last configured window of mining rounds produces zero `new_candidate` requirements.

Default window:

```txt
3 rounds
```

That means the external chat is no longer producing new, useful, observable behavior. At that point STAX should stop interrogating the external chat and improve from local proof:

- eval failures
- user disagreements
- lab runs
- command evidence
- Codex audit results
- review router outputs

The saturation report must also show:

- duplicate count in the saturation window
- rejected count in the saturation window
- last new useful requirement ID
- last new useful requirement timestamp

This prevents a weak “zero new candidates” claim from hiding vague or rejected novelty.

## Guardrails

Behavior mining does not:

- approve memory
- promote evals
- promote training data
- alter policies
- alter schemas
- alter modes
- write to linked repos
- trust external answers as authority

Everything mined is candidate-only until an existing governed workflow promotes it.

## Behavior Contract Triage

After saturation, STAX should not implement every mined requirement directly.
Run triage first.

The triage layer groups only `new_candidate` requirements into:

- `reject_noise`
- `needs_human_review`
- `eval_candidate_seed`
- `proof_receipt_candidate`
- `workspace_audit_candidate`
- `codex_handoff_candidate`
- `safety_redteam_candidate`

Every triage record has:

```txt
promotionBoundary: candidate_only
```

The current top next slice selected by triage is:

```txt
Evidence-to-Decision Gate
```

That means the next behavior implementation should prevent weak, pasted, stale,
missing, or conflicting evidence from becoming verified claims.

The first version of that gate is intentionally narrow:

- it is a pure classifier
- it writes nothing
- it distinguishes local command/trace/eval/file evidence from pasted human
  claims, inferred claims, and missing evidence
- it only affects `codex_audit` and `model_comparison`
- it does not implement the remaining 145 mined requirements
