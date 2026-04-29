# RAX Governed Intelligence Core Report

## Purpose

This pass closes the skipped intelligence-governance gap after `stax doctor`.

The goal is not to make STAX an unconstrained autonomous agent. The goal is to make model intelligence usable only when evidence, validators, critic behavior, repair, memory approval, and policy loading stay governed.

## What Changed

```txt
Provider-backed planning for non-mock providers
Provider-backed critic output for non-mock critic providers
Provider-backed repair path with fail-closed validation
EvidenceGroundingGate added
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

## Provider-Backed Planning

For `provider.name === "mock"`, planning output stays deterministic for tests and replay.

For non-mock providers, planning output now comes from the provider response and must pass the existing `PlanningValidator`, local critic, evidence grounding when repo evidence is present, and formatter/schema validation.

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
tests/memory.test.ts
tests/policyEngine.test.ts
tests/criticGateHardening.test.ts
evals/redteam/fake_complete_no_command_output.json
```

Focused proof:

```txt
non-mock provider planning text reaches final output
malformed provider planning repairs through provider-backed repair
model critic can add failures without overruling local critic
file claims require repo evidence
passed-test claims require command evidence
Codex-reported evidence stays weak
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
npm test -- --run tests/governedIntelligence.test.ts tests/evidenceGroundingGate.test.ts tests/sandboxDependencyBootstrap.test.ts tests/memory.test.ts tests/policyEngine.test.ts tests/criticGateHardening.test.ts
  passed, 6 files / 23 tests
npm test
  passed, 78 files / 420 tests
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
