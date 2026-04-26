# STAX Autonomous Improvement Lab

The Autonomous Improvement Lab extends the sandboxed Learning Lab with profile-bound cycles. It is autonomy inside the lab, not self-modification.

The loop is:

```txt
lab go
-> generate curriculum/scenarios
-> run scenarios through STAX
-> mine failures
-> create candidates
-> propose patches
-> create handoff prompts
-> create verification records
-> release gate
-> human approval
```

## Autonomy Profiles

```txt
cautious
```

Generates curriculum, generates scenarios, runs scenarios, and writes a cycle record. It does not create candidates or patches.

```txt
balanced
```

Includes cautious behavior, creates candidate artifacts for failed scenarios, mines failure clusters, and writes patch proposals.

```txt
aggressive
```

Includes balanced behavior, creates Codex handoff prompts, creates verification records, and release-gates patch proposals. It does not merge or approve anything.

```txt
experimental
```

Disabled by default. Reserved for future low-risk auto-apply experiments such as docs-only or eval-only candidates.

## What It Can Do

- Generate synthetic exposure packs.
- Generate red-team scenarios.
- Run scenarios through `RaxRuntime`.
- Create normal runs, traces, and LearningEvents.
- Mine failure clusters from lab runs.
- Create candidate eval/correction/training/memory artifacts.
- Create patch proposal artifacts under `learning/lab/patches/`.
- Create Codex handoff prompts under `learning/lab/handoffs/`.
- Create verification records using an allowlist.
- Create release-gate records.

## What It Cannot Do

- Merge code.
- Push code.
- Promote candidates.
- Approve memory.
- Export training data.
- Edit policies, schemas, modes, config, or `AGENTS.md` directly.
- Enable shell, file-write, web, or git-push permissions.
- Treat synthetic data as durable truth.

## Commands

```bash
npm run rax -- lab go --profile cautious --cycles 1 --domain planning --count 5
npm run rax -- lab go --profile balanced --cycles 1 --domain planning --count 5
npm run rax -- lab go --profile aggressive --cycles 1 --domain redteam_governance --count 5
npm run rax -- lab failures
npm run rax -- lab patches
npm run rax -- lab handoffs
npm run rax -- lab verify <patch-id>
npm run rax -- lab gate <patch-id>
```

Verification only accepts allowlisted commands:

```txt
npm run typecheck
npm test
npm run rax -- eval
npm run rax -- eval --regression
npm run rax -- eval --redteam
npm run rax -- replay <run-id>
```

## Chat Commands

```txt
/lab go cautious 1
/lab report
/lab failures
/lab patches
/lab handoffs
```

Chat can run only the cautious profile. Balanced and aggressive profiles stay CLI-only.

## Storage

```txt
learning/lab/cycles/
learning/lab/patches/
learning/lab/handoffs/
learning/lab/verification/
learning/lab/release-gates/
```

Generated artifacts are ignored by git except `.gitkeep` placeholders.

## Release Gate

Release gate statuses:

```txt
safe_to_review
needs_human
blocked
```

Blocked if verification fails, tests are missing, rollback is missing, or a patch appears to weaken tool or approval safety.

Needs human if the patch touches policy, schema, mode, config, tool behavior, or is high risk.

Safe to review means the artifact is still only a proposal. It does not mean merged, promoted, or approved.
