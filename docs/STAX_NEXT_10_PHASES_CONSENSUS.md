# STAX Next 10 Phases Consensus

Date: 2026-04-26

Status: consensus roadmap.

This document records the red-team / blue-team reconciliation after the Workspace Repo Operator landed in commit `5ae63b2`.

The goal is not to imitate ChatGPT as a model. The goal is to make STAX materially better than a normal ChatGPT planning loop inside Dean's projects by forcing useful answers through local evidence, receipts, claims, proof gates, and bounded next actions.

## Current Baseline

Workspace Repo Operator is shipped and pushed.

Proof from the previous slice:

- Commit: `5ae63b2 Add workspace repo operator evidence packs`
- `npm run typecheck`: passed
- `npm test`: 44 files / 169 tests passed
- `npm run rax -- eval`: 16/16
- `npm run rax -- eval --regression`: 39/39
- `npm run rax -- eval --redteam`: 9/9
- Smoke chat commands passed:
  - `what tests exist in this repo?`
  - `what is risky in this repo?`
  - `fix this repo`

## Red Team Verdict

STAX is currently stronger than ChatGPT at recording governance-shaped evidence, but weaker than ChatGPT at solving project problems.

The core risk is proof theater:

- headings, traces, eval artifacts, and queues can pass while the actual answer is still shallow
- mock-first runtime can produce deterministic template intelligence
- regex/property evals can pass useless but well-sectioned answers
- repo awareness can become file listing instead of project understanding
- governance modes are mostly `usable`, not `behavior_proven`

Red Team wanted a STAX-vs-ChatGPT benchmark first.

## Blue Team Verdict

Blue Team wanted Chat Operator v1B receipts first.

The argument:

- Dean should be able to ask normally.
- STAX should answer with one consistent proof receipt.
- Every plain-language control answer should show what it did, what evidence it used, what it verified, what it did not verify, what could be fake-complete, and what is allowed next.

Blue Team warned against expanding authority before the daily chat control surface is trustworthy.

## External STAX Chat Reconciliation

The external STAX planning chat initially preferred Evidence-First Project Brain v1.

After being challenged with Red Team and Blue Team objections, it changed the first slice:

```txt
First: standardize and validate proof receipts.
Then: build Evidence-First Project Brain on top.
```

Reason:

- Evidence-First Project Brain depends on trustworthy receipts.
- Without receipts, Project Brain can ingest vague audit outputs and turn them into fake project state.

## Final Consensus

The next implementation slice is:

```txt
Chat Operator v1B — Operation Receipts + Proof Quality Gate
```

This is not just formatting.

Bad receipt:

```txt
Evidence Checked:
- Repo evidence pack

Next Action:
- Review results
```

Good receipt:

```txt
Claims Verified:
- package.json has test script `vitest run` [evidence: package.json]
- tests directory exists with test files [evidence: tests/...]

Claims Not Verified:
- tests pass was not verified because no command was run

Fake-Complete Risks:
- presence of test files does not prove coverage
- no runtime test command output was supplied

Next Allowed Action:
- run the exact recommended verification command manually, or use an explicit future approved proof lane
```

## Revised 10 Phases

### Phase 1 — Chat Operator v1B: Operation Receipts + Proof Quality Gate

Purpose:

Make every recognized natural-language control operation produce a validated receipt.

User-facing chat behavior:

```txt
what tests exist in this repo?
what is risky in this repo?
fix this repo
audit this repo
what needs my judgment?
what did the last run prove?
```

Every response includes:

```md
## Operation
## Evidence Required
## Evidence Checked
## Artifacts Created
## Claims Verified
## Claims Not Verified
## Fake-Complete Risks
## Next Allowed Action
```

Likely files:

- `src/operator/OperationReceipt.ts`
- `src/operator/OperationReceiptValidator.ts`
- `src/operator/OperationFormatter.ts`
- `src/operator/OperationExecutor.ts`
- `src/operator/OperationSchemas.ts`
- `tests/chatOperatorReceipt.test.ts`
- `docs/STAX_CHAT_OPERATOR_RECEIPTS.md`
- `docs/RAX_CHAT_OPERATOR_RECEIPTS_REPORT.md`

Proof gates:

- every verified claim cites evidence
- claims without evidence move to `Claims Not Verified`
- fake-complete risks appear when tests are found but not run
- artifacts list run/trace/evidence paths or explicitly say none
- no receipt claims completion without command output

Stop condition:

Reject if `Claims Verified` contains any unsupported claim.

### Phase 2 — Evidence-First Project Brain v1

Purpose:

Turn repo evidence and operation receipts into workspace state.

User-facing chat behavior:

```txt
where are we on canvas-helper?
what is proven?
what is unproven?
what should I fix next?
```

Likely files:

- `src/project/ProjectStateSchemas.ts`
- `src/project/ProjectStateBuilder.ts`
- `src/project/ProjectStateValidator.ts`
- `src/project/ProjectStateCandidateWriter.ts`
- `tests/evidenceFirstProjectBrain.test.ts`
- `workspaces/<workspace>/state_candidates/`

Proof gates:

- no `Proven Working` without evidence
- no workspace docs overwritten automatically
- next action includes files, tests, commands, and evidence required

Stop condition:

Reject if Project Brain writes durable project state without approval.

### Phase 3 — Local Proof Benchmark v1

Purpose:

Compare STAX answers against ChatGPT-style answers using local evidence.

User-facing chat behavior:

```txt
compare this ChatGPT plan to local proof
which answer is more useful for this repo?
```

Likely files:

- `src/compare/LocalProofBenchmark.ts`
- `src/compare/ComparisonSchemas.ts`
- `src/compare/ComparisonScorer.ts`
- `tests/localProofBenchmark.test.ts`
- `docs/STAX_LOCAL_PROOF_BENCHMARK.md`

Proof gates:

- scores evidence, specificity, local accuracy, and actionability
- cannot declare a winner without local evidence

Stop condition:

Reject if the benchmark can pick a winner with no local evidence.

### Phase 4 — Codex Work Loop v1

Purpose:

Make STAX manage Codex tasks and results as a closed loop.

User-facing chat behavior:

```txt
make the next Codex task
audit this Codex result
did Codex prove it?
```

Likely files:

- `src/codex/CodexTaskBuilder.ts`
- `src/codex/CodexResultAuditor.ts`
- `src/codex/CodexProofSchemas.ts`
- `workspaces/<workspace>/codex_tasks/`
- `workspaces/<workspace>/codex_results/`

Proof gates:

- Codex task includes files, tests, commands, acceptance criteria, and stop conditions
- Codex result cannot be accepted without evidence

Stop condition:

Reject if "Codex says done" can be accepted without proof.

### Phase 5 — Workspace Claim Ledger v1

Purpose:

Track workspace claims over time.

User-facing chat behavior:

```txt
what claims are unproven?
what did we prove?
what became stale?
```

Likely files:

- `src/claims/WorkspaceClaimLedger.ts`
- `src/claims/ClaimSchemas.ts`
- `src/claims/ClaimEvidenceLinker.ts`
- `workspaces/<workspace>/claims/`

Proof gates:

- claim states: `claimed`, `tested`, `proven`, `disproven`, `stale`
- every state transition requires evidence

Stop condition:

Reject if claims can become proven without evidence.

### Phase 6 — Evidence Requirement Engine v1

Purpose:

Tell Dean exactly what proof is missing.

User-facing chat behavior:

```txt
what proof do I need?
what would make this accepted?
```

Likely files:

- `src/evidence/EvidenceRequirementEngine.ts`
- `src/evidence/EvidenceRequirementSchemas.ts`
- `tests/evidenceRequirementEngine.test.ts`

Proof gates:

- every unproven claim maps to a required evidence artifact
- no generic "run tests" without exact command or artifact type

Stop condition:

Reject if an evidence requirement does not name an exact command or artifact.

### Phase 7 — Repo Test Intelligence v1

Purpose:

Understand test structure without running external commands.

User-facing chat behavior:

```txt
what tests exist?
what tests are missing?
what should Codex add tests for?
```

Likely files:

- `src/workspace/RepoTestMap.ts`
- `src/workspace/TestGapAnalyzer.ts`
- `src/workspace/RepoEvidencePack.ts`
- `tests/repoTestIntelligence.test.ts`

Proof gates:

- lists scripts
- lists test files
- clearly says tests were not run
- never claims tests passed without command output

Stop condition:

Reject if STAX says tests pass without command output.

### Phase 8 — Review Digest UX v2

Purpose:

Reduce Dean's attention burden.

User-facing chat behavior:

```txt
what needs my judgment?
show only blockers
what can I ignore?
```

Likely files:

- `src/review/ReviewDigestFormatter.ts`
- `src/review/ReviewPriorityScorer.ts`
- `tests/reviewDigestUx.test.ts`

Proof gates:

- no approve or promote action
- every visible item has a next allowed action
- low-risk noise hidden by default

Stop condition:

Reject if low-risk noise appears by default.

### Phase 9 — Operator Telemetry v1

Purpose:

Make blocked/deferred natural-language requests become learning signals.

User-facing chat behavior:

```txt
approve all memory
stress test planning
```

STAX blocks or defers and records why.

Likely files:

- `src/operator/OperatorTelemetry.ts`
- `src/operator/OperationExecutor.ts`
- `src/learning/LearningRecorder.ts`
- `tests/operatorTelemetry.test.ts`

Proof gates:

- telemetry includes original text, intent, risk, and no-action result
- casual fallback chat does not spam telemetry

Stop condition:

Reject if unknown casual chat creates telemetry noise.

### Phase 10 — Project Release Gate v1

Purpose:

Decide whether a workspace change is trustworthy.

User-facing chat behavior:

```txt
is this ready?
can I trust this fix?
```

Likely files:

- `src/release/ProjectReleaseGate.ts`
- `src/release/ReleaseGateSchemas.ts`
- `tests/projectReleaseGate.test.ts`

Proof gates:

- statuses: `blocked`, `needs_review`, `safe_to_accept`
- requires changed files, test output, rollback, and evidence

Stop condition:

Reject if it marks safe without evidence.

## Why Not Hidden Prompts

Hidden prompts or model instructions are not a legitimate implementation dependency.

STAX should improve through observable behavior:

- local evidence
- tests
- evals
- traces
- user corrections
- claim ledgers
- release gates
- benchmark outcomes

The goal is to copy the useful workflow shape, not to extract private instructions.

## Immediate Next Commit

Build:

```txt
Chat Operator v1B — Operation Receipts + Proof Quality Gate
```

Required report:

```txt
docs/RAX_CHAT_OPERATOR_RECEIPTS_REPORT.md
```

Required code artifacts:

- `src/operator/OperationReceipt.ts`
- `src/operator/OperationReceiptValidator.ts`
- `tests/chatOperatorReceipt.test.ts`

Modify:

- `src/operator/OperationFormatter.ts`
- `src/operator/OperationExecutor.ts`
- `src/operator/OperationSchemas.ts`
- `src/chat/ChatSession.ts`

Acceptance criteria:

1. Every recognized Chat Operator intent returns a validated receipt.
2. Receipt cannot list `Claims Verified` without evidence.
3. Claims lacking evidence appear under `Claims Not Verified`.
4. `Fake-Complete Risks` is required when tests are found but not run.
5. Hard-block receipts show no action executed.
6. Deferred receipts show no action executed.
7. Judgment digest receipt proves no refresh/apply/promotion.
8. Workspace repo audit receipt lists exact files, scripts, and test files inspected.
9. No memory, eval, training, policy, schema, or mode promotion occurs.
10. Typecheck, tests, eval, regression, and redteam all pass.

## Final Decision

The next best STAX is not more autonomous yet.

The next best STAX is easier to trust.

Build receipts first, then Project Brain, then benchmark.
