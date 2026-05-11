# STAX Debloat Map

This map freezes product clarity before any file moves, deletions, or refactors.

Product thesis:

```txt
STAX is a local proof gate for AI-coded work.
```

The survival question for every surface:

```txt
Does this directly support attach -> collect -> gate -> status -> next prompt?
```

If yes, it is product core. If no, it must be classified as internal,
experimental, archive, or delete candidate before any cleanup.

## Classification Rules

- CORE: required for the proof-gate workflow.
- INTERNAL: supports safety, governance, validation, or future product surfaces
  but should not lead public positioning.
- EXPERIMENTAL: useful research or future architecture that should not define the
  public product.
- ARCHIVE: historical campaigns, proofs, reports, comparisons, and old release
  artifacts that should move out of the first user path.
- DELETE_CANDIDATE: duplicated, stale, one-off, or untested surfaces to remove
  only after archive and validation.

## CORE

### Product Workflow

- `src/sidecar/AttachStax.ts`
- `src/sidecar/CommandEvidenceCollector.ts`
- `src/sidecar/StaxGate.ts`
- `src/sidecar/StaxStatus.ts`
- `src/sidecar/NextCodexPrompt.ts`
- `src/sidecar/TurnContract.ts`
- `src/sidecar/TurnCompliance.ts`
- `src/sidecar/CodexTurnCapture.ts`
- `src/sidecar/SidecarRepo.ts`
- `src/sidecar/UpgradeSidecar.ts`

Why: these implement attach, command collection, gate, status, next prompt,
turn acknowledgement, and sidecar lifecycle.

### Proof Stack

- `src/projectControl/ProjectControlProofStack.ts`
- `src/projectControl/ProjectControlEvidencePacket.ts`
- `src/projectControl/ControlCard.ts`
- `src/projectControl/CodexReportContract.ts`
- `src/claims/ClaimProofMapping.ts`
- `src/claims/ClaimProofMappingSchemas.ts`
- `src/diffAudit/DiffAudit.ts`
- `src/diffAudit/DiffAuditSchemas.ts`
- `src/diffAudit/UnifiedDiffParser.ts`

Why: this is the heart of the product. It maps claims to required proof, checks
diffs, validates report shape, and produces verified/weak/unverified/risk
findings.

### Evidence Intelligence

- `src/evidence/CommandEvidenceIntelligence.ts`
- `src/evidence/CommandOutputParser.ts`
- `src/evidence/CommandEvidenceStore.ts`
- `src/evidence/TestQualityAnalyzer.ts`
- `src/evidence/VisualProofAnalyzer.ts`
- `src/evidence/DataPipelineProofAnalyzer.ts`
- `src/evidence/ReleaseGateAnalyzer.ts`
- `src/evidence/CiLogIntelligence.ts`
- `src/evidence/ProofBoundaryClassifier.ts`
- `src/evidence/EvidenceRequestBuilder.ts`

Why: command relevance, branch/cwd/commit checks, visual/data/release proof, and
proof-boundary classification are the difference between a useful gate and a
format checker.

### PR Audit Surface

- `src/projectControl/PullRequestArtifactAudit.ts`
- `src/projectControl/PullRequestArtifactPacket.ts`
- `src/projectControl/GitHubPrArtifactAdapter.ts`
- `src/projectControl/PullRequestReviewComment.ts`
- PR artifact tests and fixtures

Why: this should become a second product surface after the sidecar gate is clear:
audit this PR before merge.

### Public Command Wrappers

Keep as public or make public aliases:

- `scripts/staxAttach.ts`
- `scripts/staxCollect.ts`
- `scripts/staxGate.ts`
- `scripts/staxStatus.ts`
- `scripts/staxNextPrompt.ts`

Target command names:

```bash
stax attach --repo <path>
stax collect --repo <path> -- <command>
stax gate --repo <path>
stax status --repo <path>
stax next --repo <path>
```

Phase 3 status: `package.json` now has the public npm aliases `validate`,
`stax`, and `stax:next`. `stax:next-prompt` remains as a compatibility alias.
The package script surface still keeps legacy and internal commands because
GitHub workflows currently call some of them directly.

### Core Tests

Keep tests that prove the product spine:

- `tests/sidecarAttachGate.test.ts`
- `tests/sidecarWatchCollect.test.ts`
- `tests/sidecarTurnCompliance.test.ts`
- `tests/sidecarUpgrade.test.ts`
- `tests/projectControlEvidencePacket.test.ts`
- `tests/projectControlProofStackIntegration.test.ts`
- `tests/projectControlControlCard.test.ts`
- `tests/codexReportContract.test.ts`
- `tests/commandEvidenceIntelligence.test.ts`
- `tests/claimProofMapping.test.ts`
- `tests/diffAudit.test.ts`
- `tests/dataPipelineProofAnalyzer.test.ts`
- `tests/releaseGateAnalyzer.test.ts`
- `tests/pullRequestArtifactAudit.test.ts`
- `tests/githubPrArtifactAdapter.test.ts`

## INTERNAL

These can stay, but should not be the headline.

### Governance And Review

- `src/review/`
- `docs/STAX_REVIEW_ROUTER.md`
- review queue, ledger, risk scoring, batching, and judgment packet code

Reason: useful internal governance. It routes what needs Dean or human judgment,
but it should sit behind the proof gate.

### Promotion And Learning Safety

- `src/learning/PromotionGate.ts`
- `src/learning/PatternPromotionGate.ts`
- `src/learning/SidecarHarvest.ts`
- `src/learning/SidecarImportReview.ts`
- `src/learning/SidecarImportPromotion.ts`
- sidecar harvest/review/promote scripts

Reason: useful for approval-gated learning from attached repos. It is not the
public product pitch.

### Validation, Audits, And Release Gates

- `scripts/auditDoctrine.ts`
- `scripts/auditBoundaries.ts`
- `scripts/auditSecurity.ts`
- `scripts/auditEvalFixtures.ts`
- `scripts/validateStaxcoreStrictCi.ts`
- `validate:*`, `test:*`, `audit:*`, and `build` scripts

Reason: these protect the repo and release process. Keep them as internal
maintenance surfaces.

### Runtime Required By Existing Tests

- `src/core/`
- `src/policy/`
- `src/modes/`
- `src/schemas/`
- `src/classifiers/`
- `src/safety/`
- `src/security/`
- `src/providers/`
- `src/agents/`
- `src/chat/`

Reason: required by current behavior and tests. Public docs should call this the
internal engine unless a specific part supports proof gating.

## EXPERIMENTAL

These should be preserved for now, but demoted from public product identity.

### STAX Core Kernel And Sealed Truth

- `src/staxcore/`
- `docs/STAXCORE_RELEASE_PROFILES.md`
- `docs/STAX_CORE_ONE_LAYER_REBUILD_PLAN.md`

Reason: serious hardening work, but it reads as a separate research/kernel
program. It should not obscure the proof-gate product.

### Learning Lab And Adaptive Runtime Expansion

- `src/lab/`
- `src/training/`
- broad learning lab scripts
- `docs/archive/research/STAX_LEARNING_LAB.md`
- `docs/archive/research/RAX_LEARNING_LAB_REPORT.md`
- `docs/archive/research/RAX_TRAINING_DATA_MODEL.md`

Reason: candidate generation and training export are not the product right now.
They should remain approval-gated and off the main path.

### Chat, Agent, And Provider Expansion

- chat-first README positioning
- `npm run chat`
- slash-command surfaces
- agent-router/productivity framing
- provider routing beyond mock/local proof needs

Reason: useful internally, but it makes STAX sound like a generic AI assistant
instead of a proof gate.

### Superiority And Comparison Work

- `src/superiority/`
- `tests/*superiority*`
- comparison campaign fixtures and reports

Reason: the repo itself says broad superiority claims are not proven enough for
the public product promise.

## ARCHIVE

Archive before deleting. Suggested target folders:

```txt
docs/archive/campaigns/
docs/archive/releases/
docs/archive/benchmarks/
docs/archive/investor/
docs/archive/phase-plans/
docs/archive/research/
```

### Campaign And Benchmark Docs

Archived in Phase 4A:

- `docs/archive/benchmarks/STAX_GENERAL_SUPERIORITY_CAMPAIGN.md`
- `docs/archive/benchmarks/RAX_GENERAL_SUPERIORITY_CAMPAIGN_REPORT.md`
- `docs/archive/benchmarks/RAX_STAX_VS_CHATGPT_MANUAL_BENCHMARK.md`
- `docs/archive/benchmarks/RAX_STAX_VS_CHATGPT_SEED5_RESULTS.md`
- `docs/archive/benchmarks/RAX_STAX_VS_CHATGPT_SEED20_RESULTS.md`
- `docs/archive/benchmarks/RAX_STAX_VS_RAW_CHATGPT_SEED20_RESULTS.md`
- `docs/archive/benchmarks/RAX_RAW_CHATGPT_ROUND2_BENCHMARK_PLAN.md`
- `docs/archive/benchmarks/RAX_RAW_CHATGPT_ROUND2_RESULTS.md`
- `docs/archive/benchmarks/RAX_RAW_CHATGPT_ROUND3_STATEFUL_PLAN.md`
- `docs/archive/benchmarks/RAX_RAW_CHATGPT_ROUND3_RESULTS.md`
- `docs/archive/benchmarks/RAX_LOCAL_PROBLEM_BENCHMARK_REPORT.md`
- `docs/archive/benchmarks/RAX_EXTERNAL_BASELINE_IMPORT_REPORT.md`
- `docs/archive/benchmarks/RAX_EXTERNAL_SOURCE_DIVERSITY_REPORT.md`
- `docs/archive/benchmarks/RAX_BENCHMARK_ANTI_GAMING_REPORT.md`
- `docs/archive/campaigns/RAX_PHASE10_REAL_WORKFLOW_REPORT.md`
- `docs/archive/campaigns/RAX_PHASE11_SUBSCRIPTION_COMPARISON_REPORT.md`
- `docs/archive/campaigns/STAX_REAL_TASK_DOGFOOD_PROTOCOL.md`
- `docs/archive/campaigns/RAX_REAL_TASK_DOGFOOD_REPORT.md`

Not moved yet:

- `docs/RAX_REAL_USE_CAMPAIGN_REPORT.md` remains top-level because source
  prompts still reference it directly.

### Investor And Release-History Docs

Partially archived in Phase 4A:

- `docs/archive/research/RAX_AUTONOMOUS_IMPROVEMENT_LAB_REPORT.md`
- `docs/archive/releases/REPO_TRANSFER_TRIAL_PLAN.md`
- `docs/archive/releases/REPO_TRANSFER_TRIAL_RESULTS.md`
- `docs/archive/releases/REPO_TRANSFER_RC2A_HYGIENE_REPORT.md`
- `docs/archive/releases/REPO_TRANSFER_RC2A_JUDGE_ACCEPTANCE.md`

Not moved yet:

- `docs/STAX_9_5_PROMOTION_REPORT.md`
- `docs/RAX_100_PROOF_REPORT.md`
- `docs/RAX_KNOWN_GAPS_CONSENSUS_REPORT.md`
- `docs/RAX_LOCAL_PROOF_SUPERIORITY_REPORT.md`
- `docs/releases/`

### Old RAX Architecture Docs

Archive or rewrite after public docs exist:

- `docs/archive/research/RAX_ARCHITECTURE.md`
- `docs/archive/research/RAX_MASTER_SPEC.md`
- `docs/archive/phase-plans/RAX_PHASE_PLAN.md`
- `docs/archive/research/RAX_MODE_MODEL.md`
- `docs/archive/research/RAX_POLICY_MODEL.md`
- `docs/archive/research/RAX_MEMORY_MODEL.md`
- `docs/archive/research/RAX_SAFETY_MODEL.md`
- `docs/archive/research/RAX_TRAINING_DATA_MODEL.md`
- `README_RAX.md`
- `RAX_LOCAL_BLUEPRINT.md`

Reason: they may remain useful provenance, but they should not be the first path
for a new user.

## DELETE_CANDIDATE

Do not delete in this pass. Mark for later proof-backed removal.

- one-off campaign scripts with no product command path
- duplicate reports where a newer product doc supersedes them
- generated release archives after they are archived elsewhere
- stale benchmark outputs that are not fixtures
- old docs that only narrate abandoned phases
- unused modes or agent experiments after import/test coverage proves they are
  unreachable
- dead script wrappers after `package.json` public/internal split is validated

## Package Script Surface

### Keep Public

Target public scripts:

```json
{
  "build": "tsc",
  "test": "vitest run",
  "typecheck": "tsc --noEmit",
  "validate": "npm run typecheck && npm test",
  "stax": "tsx src/cli.ts",
  "stax:attach": "tsx scripts/staxAttach.ts",
  "stax:collect": "tsx scripts/staxCollect.ts",
  "stax:gate": "tsx scripts/staxGate.ts",
  "stax:status": "tsx scripts/staxStatus.ts",
  "stax:next": "tsx scripts/staxNextPrompt.ts"
}
```

Current support after Phase 3:

- `stax:attach`: present
- `stax:collect`: present
- `stax:gate`: present
- `stax:status`: present
- `stax:next`: present
- `stax:next-prompt`: present as compatibility alias
- `stax`: present as an npm script; `bin.stax` also exists for built package
- `validate`: present

### Keep Internal

- `audit:*`
- `validate:*`
- `test:*`
- `stax:sidecar-upgrade`
- `stax:turn-contract`
- `stax:watch`
- `stax:codex-collect`
- `stax:harvest`
- `stax:review-imports`
- `stax:aggregate-imports`
- `stax:promote-import`
- `stax:learning-dashboard`
- `staxcore:*`
- PR artifact score/integrity scripts
- repo onboarding and repo transfer scripts

### Archive Or Hide From Main Interface

- `campaign:*`
- `campaign:phaseB:*`
- `campaign:phase11:*`
- `campaign:investor:*`
- `campaign:closed-loop:*`
- `campaign:dogfood:*`
- `campaign:real-use:*`
- `repo-transfer:*`
- `release:rc4:command-proof`
- one-off scoring and capture scripts

Recommendation for Phase 3:

1. Copy the current full script object to
   `docs/archive/package-scripts-legacy.json`.
2. Add a small public surface.
3. Preserve internal scripts under explicit names or a documented internal
   runner.
4. Run the full suite before deleting any script file.

## Public Docs Target

Keep or create the public path:

```txt
README.md
docs/PRODUCT.md
docs/QUICKSTART.md
docs/CODEX_WORKFLOW.md
docs/PROOF_MODEL.md
docs/COMMANDS.md
docs/FAQ.md
docs/STAX_SIDECAR_DOCTRINE.md
```

Everything else must justify itself as internal docs, archive provenance, or a
future product surface.

## Demo Target

Create one small demo after the docs are rewritten:

```txt
examples/fake-complete-demo/
```

Scenario:

1. Tiny repo has a bug.
2. Codex report says work is fixed and tests passed.
3. No command evidence exists.
4. `stax gate` rejects it.
5. STAX writes a correction prompt.
6. Command evidence is collected.
7. Gate becomes Accept or Provisional.

This demo should explain STAX faster than the architecture docs.

## Do Not Do Yet

- Do not delete source code.
- Do not move folders.
- Do not rename RAX internals.
- Do not remove package scripts.
- Do not archive docs until the new public docs exist.
- Do not make STAX a UI.
- Do not add new agents.

## Next Cleanup Phases

1. Rewrite `README.md` around the product sentence: "STAX catches fake-complete
   AI coding work before you trust it."
2. Add `docs/QUICKSTART.md`, `docs/CODEX_WORKFLOW.md`, and
   `docs/PROOF_MODEL.md`.
3. Split package scripts into public and internal without deleting script files.
4. Create `examples/fake-complete-demo/`.
5. Archive historical docs by category.
6. Only then consider deleting dead code.
