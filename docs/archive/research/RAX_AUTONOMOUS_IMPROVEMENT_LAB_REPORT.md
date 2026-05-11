# RAX Autonomous Improvement Lab Report

## Summary

STAX now has a sandboxed Autonomous Improvement Lab layer on top of the existing Learning Lab Workers.

This is not autonomous self-modification. It is profile-bound lab autonomy:

```txt
lab go
-> scenario generation
-> STAX runs
-> LearningEvents
-> failure mining
-> candidate artifacts
-> patch proposals
-> handoff prompts
-> verification records
-> release gates
-> human approval
```

No lab profile can merge, promote, approve memory, export training data, edit durable policy/schema/mode/config state, or enable unsafe tools.

## Files Created

- `src/lab/AutonomyProfile.ts`
- `src/lab/LabOrchestrator.ts`
- `src/lab/FailureMiner.ts`
- `src/lab/PatchPlanner.ts`
- `src/lab/CodexHandoffWorker.ts`
- `src/lab/VerificationWorker.ts`
- `src/lab/ReleaseGate.ts`
- `tests/autonomousImprovementLab.test.ts`
- `docs/STAX_AUTONOMOUS_IMPROVEMENT_LAB.md`
- `docs/RAX_AUTONOMOUS_IMPROVEMENT_LAB_REPORT.md`
- `learning/lab/cycles/.gitkeep`
- `learning/lab/patches/.gitkeep`
- `learning/lab/handoffs/.gitkeep`
- `learning/lab/verification/.gitkeep`
- `learning/lab/release-gates/.gitkeep`

## Files Modified

- `.gitignore`
- `README.md`
- `docs/STAX_LEARNING_LAB.md`
- `docs/STAX_CHAT_INTERFACE.md`
- `docs/CHAT_CLI.md`
- `src/chat/ChatSession.ts`
- `src/cli.ts`
- `src/index.ts`
- `src/lab/LabRunner.ts`
- `src/lab/LearningWorker.ts`

## Autonomy Profiles

- `cautious`: generate and run scenarios only; no candidates or patches.
- `balanced`: create candidates and patch proposals from failures.
- `aggressive`: create Codex handoff prompts and verification records too.
- `experimental`: disabled by default.

Every profile has `canAutoMerge=false`.

## Commands Added

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

Chat additions:

```txt
/lab go cautious 1
/lab failures
/lab patches
/lab handoffs
```

Chat still cannot approve, promote, merge, or run balanced/aggressive profiles.

## Tests Added

`tests/autonomousImprovementLab.test.ts` proves:

- autonomy profiles enforce permissions and do not enable auto-merge.
- experimental profile is disabled by default.
- repeated failures cluster.
- promotion-bypass red-team failures become critical clusters.
- patch proposals include tests and rollback.
- verification rejects disallowed commands.
- release gate blocks failed verification.
- cautious cycles create no candidates, patches, evals, or training exports.
- chat can run `/lab go cautious 1` and inspect lab autonomy views without approval commands.

## Smoke Results

### Cautious Cycle

Command:

```bash
npm run rax -- lab go --profile cautious --cycles 1 --domain planning --count 5
```

Result:

```txt
scenariosGenerated: 5
scenariosRun: 5
failures: 0
candidatesCreated: 0
patchesProposed: 0
releaseGate: safe_to_review
```

### Balanced Cycle

Command:

```bash
npm run rax -- lab go --profile balanced --cycles 1 --domain planning --count 5
```

Result:

```txt
scenariosGenerated: 10
scenariosRun: 10
failures: 0
candidatesCreated: 0
patchesProposed: 0
releaseGate: safe_to_review
```

The balanced cycle ran planning scenarios plus red-team scenarios. They passed, so no patch was proposed from that cycle.

### Aggressive Cycle

Command:

```bash
npm run rax -- lab go --profile aggressive --cycles 1 --domain redteam_governance --count 5
```

Result:

```txt
scenariosGenerated: 5
scenariosRun: 5
failures: 0
candidatesCreated: 0
patchesProposed: 0
handoffsCreated: 0
verificationResults: 0
releaseGate: safe_to_review
```

The aggressive red-team cycle passed cleanly. Since there were no failures, it did not fabricate patches.

## Failure Mining Example

Command:

```bash
npm run rax -- lab failures
```

Result from the existing forced-failure smoke artifact:

```txt
failureType: missing_section
mode: planning
domain: planning
count: 1
severity: minor
suggestedQueueTypes:
- eval_candidate
- mode_contract_patch_candidate
- codex_prompt_candidate
```

## Patch Proposal Example

Command:

```bash
npm run rax -- lab patches
```

Generated:

```txt
learning/lab/patches/patch-missing_section-2026-04-26T03-12-18-202Z-cl79b6.json
learning/lab/patches/patch-missing_section-2026-04-26T03-12-18-202Z-cl79b6.md
```

The proposal includes:

- files to inspect.
- files likely to modify.
- tests to add.
- validation commands.
- acceptance criteria.
- rollback plan.
- a bounded Codex prompt.
- `approvalRequired: true`.

## Handoff Example

Command:

```bash
npm run rax -- lab handoffs
```

Generated:

```txt
learning/lab/handoffs/handoff-2026-04-26T03-12-22-767Z-lx89fk.md
```

The handoff prompt forbids direct approval, promotion, merge, safety-gate weakening, and synthetic-data promotion.

## Verification Example

Command:

```bash
npm run rax -- lab verify patch-missing_section-2026-04-26T03-12-18-202Z-cl79b6
```

Result:

```txt
commandsRun:
- npm run typecheck
passed: true
skipped: true
```

By default, `lab verify` records allowed verification intent without running arbitrary shell. Actual execution requires the explicit `--execute` flag and remains allowlisted.

## Release Gate Example

Command:

```bash
npm run rax -- lab gate patch-missing_section-2026-04-26T03-12-18-202Z-cl79b6
```

Result:

```txt
status: needs_human
reason: human review required for policy/schema/mode/tool/config or high-risk change
```

The release gate originally over-flagged a safety boundary phrase (`Do not enable shell/fileWrite`) as a risky enablement. That was corrected so prohibitions are not treated as requested tool expansion.

## Lab Metrics

Command:

```bash
npm run rax -- lab report
```

Result:

```txt
scenariosGenerated: 31
scenariosRun: 31
passRate: 0.968
candidatesCreated: 3
approvalRate: 0
redteamPassRate: 1
```

The three candidates came from the existing forced-failure smoke artifact and remained under `learning/lab/candidates/`.

## Validation

```txt
npm run typecheck: passed
npm test: 35 files / 109 tests passed
npm run build: passed
npm run rax -- eval: 16/16 passed
npm run rax -- eval --regression: 25/25 passed
npm run rax -- eval --redteam: 9/9 passed
```

## Approval Boundaries

The Autonomous Improvement Lab does not:

- approve candidates.
- promote evals.
- approve memory.
- write approved memory.
- export training data.
- edit policies, schemas, modes, config, or `AGENTS.md`.
- enable shell/fileWrite/web/git-push tools.
- merge or push branches.

Generated patches and handoffs are proposal artifacts only.

## Limitations

- Aggressive mode currently creates verification records and handoff prompts; it does not create branches or PRs.
- Verification execution is allowlisted and requires explicit `--execute`.
- Patch proposals are generated only from observed failures. Clean cycles do not fabricate work.
- Synthetic lab data remains quarantined until explicitly reviewed and promoted through existing approval paths.
