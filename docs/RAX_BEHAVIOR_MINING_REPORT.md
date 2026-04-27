# RAX Behavior Mining Report

Date: 2026-04-27

Status: implemented.

## Goal

Add a clean-room saturation workflow for mining useful observable behavior from an external STAX-like ChatGPT conversation.

This is the answer to:

```txt
How do we know we have extracted as much useful value as possible?
```

The answer is not hidden prompts. The answer is saturation:

```txt
If repeated external-chat rounds stop producing new useful observable requirements, mining is done.
```

## Files Created

- `src/compare/BehaviorMiner.ts`
- `tests/behaviorMining.test.ts`
- `docs/STAX_BEHAVIOR_MINING.md`
- `docs/RAX_BEHAVIOR_MINING_REPORT.md`

## Files Modified

- `src/cli.ts`
- `src/chat/ChatSession.ts`
- `tests/chatSession.test.ts`

## Commands Added

```bash
npm run rax -- mine prompt
npm run rax -- mine round --stax stax-answer.md --external external-answer.md --task task.md --evidence evidence.md
npm run rax -- mine report
npm run rax -- mine requirements
```

## Chat Commands Added

```txt
/mine prompt
/mine external <external behavior spec>
/mine report
/mine requirements
```

## Behavior

`BehaviorMiner` extracts external recommendations into requirement candidates and classifies them as:

- `new_candidate`
- `captured`
- `duplicate`
- `rejected`

The miner rejects hidden-prompt or private-instruction dependent content.

## Saturation Rule

Default saturation window:

```txt
3 mining rounds
```

Saturated means:

```txt
last 3 rounds produced zero new_candidate requirements
```

When saturated, STAX should stop interrogating the external chat for new behavior and shift improvement pressure back to:

- local proof
- eval failures
- user disagreements
- Learning Lab failures
- Codex audit evidence
- review router outputs

The saturation report includes duplicate and rejected counts plus the latest new requirement ID/timestamp so saturation cannot hide rejected or duplicate novelty.

## Proof Boundaries

The mining workflow does not:

- reveal or depend on hidden prompts
- approve memory
- promote evals
- promote training data
- mutate policies
- mutate schemas
- mutate modes
- write to linked repos
- treat external answers as authority

## Tests Added

- extracts clean-room behavior and rejects hidden-prompt dependence
- marks repeated external behavior as duplicate
- detects saturation over a configured window
- prints a safe browser prompt
- supports chat `/mine` workflow without promotion

## Validation

Run after implementation:

```bash
npm run typecheck
npm test
npm run rax -- mine prompt
npm run rax -- mine report
```

Actual implementation validation:

```txt
npm run typecheck: passed
npm test: 45 files / 174 tests passed
npm run rax -- eval: 16/16 passed
npm run rax -- eval --regression: 39/39 passed
npm run rax -- eval --redteam: 9/9 passed
npm run rax -- mine prompt: passed
npm run rax -- mine report: passed
```

Post dual-mode validation:

```txt
npm run typecheck: passed
npm test: 45 files / 174 tests passed
npm run rax -- mine report: saturated, 17 rounds, 145 new candidates, 0 new candidates in final 3-round window
npm run rax -- eval: 16/16 passed
npm run rax -- eval --regression: 39/39 passed
npm run rax -- eval --redteam: 9/9 passed
```

Initial clean-room mining run against the opened ChatGPT STAX conversation:

```txt
Rounds recorded: 8
Useful candidates extracted: 43
Final window new candidates: 0
Saturated: true
Stop condition: No new useful behavior candidates were found in the last 3 mining rounds.
```

Notable behavior candidates mined before saturation:

- stale evidence invalidation
- relevance-first evidence selection
- conflicting evidence detection
- evidence strength labels
- high-confidence proof thresholds
- workspace ambiguity blocking
- pasted evidence labeled as human-provided rather than local command output
- changed-conclusion explanation
- artifact/noise budget before broad operations
- unsupported-domain boundary when no hardened mode/evals exist
- evidence coverage ratio
- assumption ledger for inferences
- negative evidence reporting
- scope-limited conclusions
- stable evidence IDs for verified claims
- verification debt carried forward
- no-action receipts for blocked/deferred requests

## Dual-Mode Mining Pass

After the initial saturation pass, the user asked for a way to switch between the
external chat's stricter STAX-like behavior and its more general strategist
behavior.

The switch used was explicit and clean-room:

```txt
STRICT STAX MODE
GENERAL STRATEGIST MODE
```

This does not reveal or depend on hidden prompts. It only asks the external chat
to produce observable behavior requirements in two response styles.

### Strict STAX Mode Findings

Strict STAX mode produced 43 new candidates across two non-saturated rounds.

Notable additions:

- version-bound recommendations
- known-issue deduplication
- priority ranking with rationale
- minimal reproduction requirements for bug fixes
- changed-file impact analysis
- PII/student/client data redaction
- pasted command output parsing into structured evidence
- constraint collision detection
- claim freshness windows by claim type
- test recommendations classified by type, failure, and risk
- Codex task size gate
- result-to-requirement backcheck
- partial-failure receipts
- toolchain/runtime preconditions
- lockfile/manifest consistency
- generated/vendor file boundary
- rollback plan for source/dependency/config/test changes
- dependency graph boundary
- next-action source rationale

### General Strategist Mode Findings

General strategist mode produced 24 new candidates across two non-saturated
rounds.

Notable additions:

- same-evidence stability check
- symbol-level grounding
- static blast-radius map
- synthetic fixture representativeness labels
- external platform/API uncertainty boundary
- UI workflow path reconstruction
- artifact lifecycle receipts
- runtime config precedence
- data contract/schema boundary
- permission/role boundary
- state persistence boundary
- success-vs-failure path evidence
- user-visible regression checks
- dependency/API responsibility separation
- backward compatibility and migration requirements
- generated-output determinism
- human handoff/paste-back contract

### Combined Dual-Mode Challenge Findings

The combined strict/general challenge produced 35 more candidates before
saturating.

Notable additions:

- performance/resource budget boundary
- benchmark/build-size evidence requests
- flaky/nondeterministic test evidence detection
- repeatable reproduction requirement
- observability/debuggability boundary
- environment matrix boundary
- evidence class distinction between local, CI, pasted, and inferred evidence
- user/project value check
- simpler high-impact alternative comparison
- reversible/costly/deadline-sensitive decision classification
- daily-use adoption friction check
- build-versus-use gate
- license/distribution compatibility boundary
- dependency vulnerability evidence boundary
- monorepo/package boundary detection
- accessibility evidence boundary for UI repos
- credential/secret setup boundary
- usage/cost budget boundary
- review ownership/accountability
- outcome metrics for workflow improvements
- operational runbook requirements
- feature kill/decommission criteria

### Final Saturation Result

Final behavior mining saturation report:

```txt
Rounds recorded: 17
Total useful requirements extracted: 145
Final window new candidates: 0
Final window duplicates: 0
Final window rejected: 0
Saturated: true
Stop condition: No new useful behavior candidates were found in the last 3 mining rounds.
```

The final three rounds were explicit dual-mode saturation confirmations. Both
strict STAX mode and general strategist mode returned:

```txt
SATURATED: no new useful observable behavior.
```

## Remaining Limitations

- Mining uses deterministic text extraction, not a semantic model judge.
- Browser interaction still requires manual or assisted paste of external answers into `mine round` or `/mine external`.
- Saturation is only as strong as the task set being mined. This pass saturated
  the current STAX/general-strategy behavior extraction task set; future real
  project failures may still create new behavior requirements.
