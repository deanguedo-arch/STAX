# STAX General Superiority Campaign

## Purpose

The local problem benchmark proved STAX can beat captured external answers on
bounded repo-task slices. That is not the same as proving STAX is better than
ChatGPT as Dean's general work system.

The General Superiority Campaign is the broader gate. It asks:

```txt
Does STAX beat external ChatGPT baselines across the range of work Dean actually does?
```

This is still not a claim that STAX is better at every possible human task.
The practical target is broader than repo work and includes strategy, creative
ideation, teaching/course design, research synthesis, writing/editing,
planning, code implementation planning, personal/project memory, tool/document
work, self-improvement, and messy judgment.

## Commands

```bash
npm run rax -- superiority status
npm run rax -- superiority score
npm run rax -- superiority failures
npm run rax -- superiority prompt
```

Use `--file <fixture.json>` or `--fixtures <dir>` to score a specific campaign
fixture or directory.

## Gate

The default gate requires:

- 250 total comparisons.
- 250 locked-before-external blind comparisons.
- 12 broad work lanes.
- 12 task families.
- 7 repos or domains.
- 2 external sources or capture contexts.
- 3 external capture dates.
- Zero `external_better`.
- Zero `tie`.
- Zero `no_local_basis`.
- Zero `no_external_baseline`.
- Zero expected-winner mismatches.

Any tie is a failure to prove superiority. It may be a good learning signal,
but it is not a win.

Blind comparisons are counted through `FirstPassIntegrityGate`. A case must
preserve locked first-pass fixture metadata, a recorded first-pass winner, and
no post-correction label before it contributes to the blind-comparison metric.

## External ChatGPT STAX Role

Use the open ChatGPT STAX thread as an external baseline and critic. Do not ask
for hidden prompts or private instructions. Ask for observable behavior:

- hard tasks
- baseline answers
- criticism of STAX answers
- benchmark invalidation risks
- missing work lanes
- new rubrics

The useful prompt is:

```txt
You are the external baseline for a STAX general superiority campaign.

Answer the task using ONLY the supplied evidence/context.
Do not drift into STAX architecture advice unless the task is about STAX.
Give a direct answer and one concrete next proof/action step.
Do not claim tests pass, builds pass, deployment works, or fixes are complete unless supplied evidence includes command output proving it.
If evidence is missing, say exactly what evidence is missing.
Return 2-4 sentences only.

The benchmark is blind: STAX must answer before this external answer is captured.
```

## Protocol

1. Create fresh tasks across broad work lanes.
2. Capture or generate STAX answers first.
3. Lock those answers with `staxCapturedAt`.
   Preserve the locked fixture path in `lockedStaxFixture` or per-case
   `lockedFixturePath`.
4. Capture external answers afterward.
5. Run `npm run rax -- superiority status`.
6. Convert every loss or tie into correction/eval/prompt candidates.
7. Add fresh tasks instead of polishing the same exam.
8. Repeat until the gate passes.

## Current Meaning

`not_proven` means STAX has not proven broad superiority.

`campaign_slice` means the current slice has no losses/ties/baseline gaps, but
coverage is still too narrow.

`superiority_candidate` means the campaign gate passed. It still deserves a
fresh challenge before any product claim.

## Guardrails

- No hidden prompt extraction.
- No self-approval.
- No auto-promotion to memory, evals, training, schemas, policies, or modes.
- No linked repo mutation.
- No claim of general superiority from one slice.
