# RAX Governed Intelligence Core Report

## Purpose

This pass closes the skipped intelligence-governance gap after `stax doctor`.

The goal is not to make STAX an unconstrained autonomous agent. The goal is to make model intelligence usable only when evidence, validators, critic behavior, repair, memory approval, and policy loading stay governed.

## What Changed

```txt
Provider-backed planning for non-mock providers
Provider-backed analyst output for non-mock codex_audit, project_brain, and code_review
Provider-backed critic output for non-mock critic providers
Structured ModelCriticReview schema path for non-mock critic JSON
Provider-backed repair path with fail-closed validation
EvidenceGroundingGate added
EvidenceGroundingGate hardened so weak command evidence cannot support hard runtime claims
Memory simple-add path now defaults to pending approval
PolicyCompiler now loads mode contracts from configured rootDir
Repo evidence is injected into repo-facing runtime context when linkedRepoPath is supplied
Model critic failures can add failures; local critic remains authority
Redteam fake-complete eval added
```

## Safety Rules Preserved

```txt
mock provider remains deterministic
local CriticGate remains authoritative
provider output must still pass validators
repair cannot convert unverified proof into verified proof
raw model output does not auto-save to approved memory
unsupported repo/file/test claims fail or remain unverified
shell and file-write defaults are unchanged
```

## Evidence Grounding

`EvidenceGroundingGate` scans user-facing output for:

```txt
file path claims
command claims
test/build/eval pass claims
completion claims
verification claims
```

It classifies each as:

```txt
supported
weak
unsupported
not_applicable
```

Local STAX command evidence is strong proof. Human-pasted and Codex-reported command evidence remain weak/provisional.

Hard runtime claims such as `npm test passed`, `build verified`, or `done` now require local STAX command evidence. Codex-reported or human-pasted evidence can remain in the output only when the claim is explicitly phrased as provisional, for example `Codex reported npm test passed; treat this as provisional`.

## Provider-Backed Planning

For `provider.name === "mock"`, planning output stays deterministic for tests and replay.

For non-mock providers, planning output now comes from the provider response and must pass the existing `PlanningValidator`, local critic, evidence grounding when repo evidence is present, and formatter/schema validation.

## Provider-Backed Analyst Modes

For `provider.name === "mock"`, analyst-mode output stays deterministic for tests, replay, and eval stability.

For non-mock providers, these analyst modes now use provider response text as the final primary output instead of burying it in metadata:

```txt
codex_audit
project_brain
code_review
```

The output still passes mode validators, local critic review, model critic review, repair where allowed, and evidence grounding when repo evidence is present. Invalid provider output is not silently replaced with the old scripted analyst template.

## Structured Model Critic

Non-mock critic providers may now return structured JSON matching `ModelCriticReviewSchema`:

```txt
pass
severity
reasoningQuality
evidenceQuality
unsupportedClaims
inventedSpecifics
fakeCompleteRisk
missingNextAction
policyViolations
requiredFixes
confidence
```

STAX renders that review into the critic output with a parseable structured section. Local `CriticGate` remains authoritative; the model critic can add failures but cannot remove local failures.

## Repair

`RepairController` is no longer a no-op. It can:

```txt
remove unsupported claims deterministically
repair missing headings where possible
call a non-mock provider for a bounded repair candidate
revalidate repaired output
fail closed if repair remains invalid
```

## Memory Hardening

The legacy/simple `MemoryStore.add("project" | "session", text)` path now creates pending memory by default. Search still retrieves only approved, non-expired memory.

## Tests

```txt
tests/governedIntelligence.test.ts
tests/evidenceGroundingGate.test.ts
tests/modelCriticReview.test.ts
tests/memory.test.ts
tests/policyEngine.test.ts
tests/criticGateHardening.test.ts
evals/redteam/fake_complete_no_command_output.json
```

Focused proof:

```txt
non-mock provider planning text reaches final output
non-mock provider codex_audit text reaches final output
non-mock provider project_brain and code_review text reach final output
malformed provider planning repairs through provider-backed repair
structured model critic can add failures without overruling local critic
file claims require repo evidence
passed-test claims require local STAX command evidence
Codex-reported evidence stays weak and cannot support a hard pass claim
simple memory writes stay pending
mode contracts load from configured rootDir
```

## What This Does Not Do

```txt
does not make agents autonomous
does not let model critic override local safety
does not auto-promote memory/evals/training/policies/schemas/modes
does not run shell commands
does not mutate linked repos
does not prove global superiority
```

## Validation Results

```txt
npm run typecheck
  passed
npm test -- --run tests/evidenceGroundingGate.test.ts tests/governedIntelligence.test.ts tests/modelCriticReview.test.ts
  passed, 3 files / 12 tests
npm test
  passed, 79 files / 426 tests
npm run rax -- eval
  passed, 16/16
npm run rax -- eval --regression
  passed, 47/47
npm run rax -- eval --redteam
  passed, 10/10
npm run rax -- doctor
  passed; mock provider warnings, disabled shell/fileWrite, memory approval, latest eval/run, command evidence, repo evidence, and git state displayed
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
  passed smoke
```

## Proof Status

This advances STAX from a deterministic governance shell toward governed intelligence for non-mock planning and criticism. It does not prove broad model superiority or autonomous execution.
