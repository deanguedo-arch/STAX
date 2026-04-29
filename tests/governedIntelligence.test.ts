import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import type { CompleteRequest, CompleteResponse, ModelProvider } from "../src/providers/ModelProvider.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-governed-intelligence-"));
}

class ScriptedProvider implements ModelProvider {
  name = "openai";
  model = "test-model";
  calls: string[] = [];

  constructor(private script: (request: CompleteRequest) => string) {}

  async complete(request: CompleteRequest): Promise<CompleteResponse> {
    const text = this.script(request);
    this.calls.push(text);
    return { text, usage: { totalTokens: text.length } };
  }
}

describe("governed intelligence runtime", () => {
  it("uses non-mock provider text as the planning output instead of the canned template", async () => {
    const rootDir = await tempRoot();
    const provider = new ScriptedProvider((request) => {
      const prompt = request.messages.at(-1)?.content ?? "";
      if (prompt.includes("Audit this agent output")) return criticPass();
      return validPlan("src/providers/RealPlanner.ts", "provider-backed planning path");
    });
    const runtime = await createDefaultRuntime({ rootDir, provider });

    const output = await runtime.run("Plan provider-backed planning.", [], { mode: "planning" });

    expect(output.output).toContain("src/providers/RealPlanner.ts");
    expect(output.output).toContain("provider-backed planning path");
    expect(output.output).not.toContain("src/classifiers/ModeDetector.ts");
  });

  it("uses provider-backed repair and fails closed before accepting malformed planning output", async () => {
    const rootDir = await tempRoot();
    const provider = new ScriptedProvider((request) => {
      const prompt = request.messages.at(-1)?.content ?? "";
      if (prompt.includes("Repair this STAX output")) return validPlan("src/validators/RepairController.ts", "provider-backed repair path");
      if (prompt.includes("Audit this agent output")) return criticPass();
      return "## Objective\nBuild it.";
    });
    const runtime = await createDefaultRuntime({ rootDir, provider });

    const output = await runtime.run("Plan a malformed provider repair test.", [], { mode: "planning" });

    expect(output.output).toContain("src/validators/RepairController.ts");
    expect(output.output).toContain("provider-backed repair path");
  });

  it("lets a non-mock model critic add failures but not override local authority", async () => {
    const rootDir = await tempRoot();
    const generator = new ScriptedProvider((request) => {
      const prompt = request.messages.at(-1)?.content ?? "";
      if (prompt.includes("Repair this STAX output")) return validPlan("src/core/RaxRuntime.ts", "repair fallback path");
      return validPlan("src/core/RaxRuntime.ts", "critic-adversary path");
    });
    const critic = new ScriptedProvider(() => JSON.stringify({
      pass: false,
      severity: "major",
      reasoningQuality: "adequate",
      evidenceQuality: "weak",
      unsupportedClaims: ["completion claim lacks command evidence"],
      inventedSpecifics: [],
      fakeCompleteRisk: ["provider output sounds complete without proof"],
      missingNextAction: [],
      policyViolations: [],
      requiredFixes: ["remove fake-complete language"],
      confidence: "high"
    }));
    const runtime = await createDefaultRuntime({
      rootDir,
      provider: generator,
      roleProviders: { critic }
    });

    const output = await runtime.run("Plan critic adversary handling.", [], { mode: "planning" });

    expect(output.output).toContain("## Critic Failure");
    expect(output.output).toContain("Model critic failure");
  });

  it("falls back to textual model critic failure parsing when structured critic JSON is malformed", async () => {
    const rootDir = await tempRoot();
    const generator = new ScriptedProvider((request) => {
      const prompt = request.messages.at(-1)?.content ?? "";
      if (prompt.includes("Repair this STAX output")) return validPlan("src/core/RaxRuntime.ts", "repair fallback path");
      return validPlan("src/core/RaxRuntime.ts", "loose critic fallback path");
    });
    const critic = new ScriptedProvider(() => [
      "{ not valid json",
      "## Critic Review",
      "- Pass/Fail: Fail",
      "- Issues Found: unsupported completion claim",
      "- Required Fixes: remove invented proof",
      "- Confidence: high"
    ].join("\n"));
    const runtime = await createDefaultRuntime({
      rootDir,
      provider: generator,
      roleProviders: { critic }
    });

    const output = await runtime.run("Plan malformed critic fallback.", [], { mode: "planning" });

    expect(output.output).toContain("## Critic Failure");
    expect(output.output).toContain("Model critic failure");
    expect(output.output).toContain("unsupported completion claim");
  });

  it("does not let a model critic pass override local validation failure", async () => {
    const rootDir = await tempRoot();
    const generator = new ScriptedProvider((request) => {
      const prompt = request.messages.at(-1)?.content ?? "";
      if (prompt.includes("Repair this STAX output")) return "## Objective\nStill malformed.";
      return "## Objective\nStill malformed.";
    });
    const critic = new ScriptedProvider(() => JSON.stringify({
      pass: true,
      severity: "none",
      reasoningQuality: "adequate",
      evidenceQuality: "adequate",
      confidence: "medium"
    }));
    const runtime = await createDefaultRuntime({
      rootDir,
      provider: generator,
      roleProviders: { critic }
    });

    const output = await runtime.run("Plan local critic authority.", [], { mode: "planning" });

    expect(output.output).toContain("## Critic Failure");
    expect(output.output).toContain("Missing required heading");
  });

  it("uses non-mock provider text as codex_audit output instead of the scripted analyst template", async () => {
    const rootDir = await tempRoot();
    const provider = new ScriptedProvider((request) => {
      const prompt = request.messages.at(-1)?.content ?? "";
      if (prompt.includes("Audit this agent output")) return criticPass();
      return validCodexAudit("provider-backed codex audit marker");
    });
    const runtime = await createDefaultRuntime({ rootDir, provider });

    const output = await runtime.run("Audit this Codex report.", [], { mode: "codex_audit" });

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("provider-backed codex audit marker");
    expect(output.output).not.toContain("No Codex claim supplied.");
  });

  it("uses non-mock provider text for project_brain and code_review analyst modes", async () => {
    const rootDir = await tempRoot();
    const provider = new ScriptedProvider((request) => {
      const prompt = request.messages.at(-1)?.content ?? "";
      if (prompt.includes("Audit this agent output")) return criticPass();
      if (prompt.includes("Review this code")) return validCodeReview("provider-backed code review marker");
      return validProjectBrain("provider-backed project brain marker");
    });
    const runtime = await createDefaultRuntime({ rootDir, provider });

    const projectBrain = await runtime.run("Summarize project state.", [], { mode: "project_brain" });
    const codeReview = await runtime.run("Review this code diff.", [], { mode: "code_review" });

    expect(projectBrain.validation.valid).toBe(true);
    expect(projectBrain.output).toContain("provider-backed project brain marker");
    expect(projectBrain.output).not.toContain("Behavior System v0.1 proof report");
    expect(codeReview.validation.valid).toBe(true);
    expect(codeReview.output).toContain("provider-backed code review marker");
    expect(codeReview.output).not.toContain("No concrete code context was supplied.");
  });

  it("uses non-mock provider text for remaining analyst governance modes", async () => {
    const rootDir = await tempRoot();
    const provider = new ScriptedProvider((request) => {
      const prompt = request.messages.at(-1)?.content ?? "";
      if (prompt.includes("Audit this agent output")) return criticPass();
      if (prompt.includes("Compare")) return validModelComparison("provider-backed model comparison marker");
      if (prompt.includes("policy")) return validPolicyDrift("provider-backed policy drift marker");
      if (prompt.includes("test gap")) return validTestGapAudit("provider-backed test gap marker");
      return validAnalysis("provider-backed analysis marker");
    });
    const runtime = await createDefaultRuntime({ rootDir, provider });

    const testGap = await runtime.run("Run test gap audit for provider-backed analysis.", [], { mode: "test_gap_audit" });
    const policyDrift = await runtime.run("Audit policy drift for provider-backed analysis.", [], { mode: "policy_drift" });
    const modelComparison = await runtime.run("Compare STAX Answer and External Answer.", [], { mode: "model_comparison" });
    const analysis = await runtime.run("Analyze provider-backed analyst mode.", [], { mode: "analysis" });

    expect(testGap.validation.valid).toBe(true);
    expect(testGap.output).toContain("provider-backed test gap marker");
    expect(testGap.output).not.toContain("Unknown until tests and eval fixtures are inspected.");
    expect(policyDrift.validation.valid).toBe(true);
    expect(policyDrift.output).toContain("provider-backed policy drift marker");
    expect(policyDrift.output).not.toContain("Evidence rules remain required.");
    expect(modelComparison.validation.valid).toBe(true);
    expect(modelComparison.output).toContain("provider-backed model comparison marker");
    expect(modelComparison.output).not.toContain("Prefer the answer that names exact files");
    expect(analysis.validation.valid).toBe(true);
    expect(analysis.output).toContain("provider-backed analysis marker");
    expect(analysis.output).not.toContain("## Facts Used\n- Analyze provider-backed analyst mode.");
  });
});

function criticPass(): string {
  return [
    "## Critic Review",
    "- Pass/Fail: Pass",
    "- Issues Found: None identified.",
    "- Required Fixes: None",
    "- Confidence: medium"
  ].join("\n");
}

function validPlan(filePath: string, marker: string): string {
  return [
    "## Objective",
    `Implement ${marker}.`,
    "",
    "## Current State",
    "- Provider-backed behavior is currently guarded by local validators, repair, critic review, and command evidence requirements.",
    "",
    "## Concrete Changes Required",
    "1. Update the bounded runtime seam.",
    "2. Add focused tests for the new governed behavior.",
    "3. Keep mock provider behavior deterministic.",
    "",
    "## Files To Create Or Modify",
    `- ${filePath}`,
    "- tests/governedIntelligence.test.ts",
    "",
    "## Tests / Evals To Add",
    "- Add a runtime test for provider-backed planning.",
    "- Add a repair test for malformed provider output.",
    "- Add a redteam eval for fake-complete output.",
    "",
    "## Commands To Run",
    "- npm run typecheck",
    "- npm test",
    "- npm run rax -- eval",
    "- npm run rax -- eval --redteam",
    "",
    "## Acceptance Criteria",
    "- Non-mock provider text appears in final planning output when it passes validation.",
    "- Invalid provider output fails or repairs through the governed repair path.",
    "",
    "## Risks",
    "- Provider text can hallucinate proof if evidence grounding is not enforced.",
    "",
    "## Rollback Plan",
    "- Revert the provider-backed planning seam and keep deterministic mock output.",
    "",
    "## Evidence Required",
    "- Passing npm run typecheck output.",
    "- Passing npm test output.",
    "- Passing npm run rax -- eval output.",
    "",
    "## Codex Prompt",
    `Implement ${marker} with local validation, critic review, and evidence grounding.`
  ].join("\n");
}

function validCodexAudit(marker: string): string {
  return [
    "## Audit Type",
    "- Reasoned Opinion",
    "## Evidence Checked",
    "- Supplied report text only.",
    "## Claims Verified",
    "- None from local command evidence.",
    "## Claims Not Verified",
    "- Runtime pass/fail claims remain unverified.",
    "## Risks",
    `- ${marker}.`,
    "## Required Next Proof",
    "- Run npm test and capture local STAX command evidence.",
    "## Recommendation",
    "- Treat as reasoned opinion until command evidence exists.",
    "## Evidence Decision",
    "- Decision: reasoned_opinion",
    "## Codex Claim",
    "- Provider-backed audit should become final output.",
    "## Evidence Found",
    "- None found.",
    "## Missing Evidence",
    "- Local command output missing.",
    "## Files Modified",
    "- Unknown",
    "## Tests Added",
    "- Unknown",
    "## Commands Run",
    "- None supplied.",
    "## Violations",
    "- None identified from supplied input.",
    "## Fake-Complete Flags",
    "- Runtime claims are not verified.",
    "## Required Fix Prompt",
    "Return exact files, commands, outputs, and remaining failures.",
    "## Approval Recommendation",
    "- Reject until local evidence exists."
  ].join("\n");
}

function validProjectBrain(marker: string): string {
  return [
    "## Project State",
    `- ${marker}.`,
    "## Current Objective",
    "- Make repo-facing analyst modes genuinely provider-backed while preserving governance.",
    "## Proven Working",
    "- ev_101: Provider-backed planning is covered by governed intelligence tests.",
    "## Unproven Claims",
    "- Analyst mode quality is not globally proven.",
    "## Recent Changes",
    "- Provider-backed analyst seam under test.",
    "## Known Failures",
    "- None supplied.",
    "## Risk Register",
    "- Provider output can hallucinate without validation and grounding.",
    "## Missing Tests",
    "- Live provider quality still needs adversarial evals.",
    "## Fake-Complete Risks",
    "- Do not claim broad superiority from one passing mode.",
    "## Next 3 Actions",
    "1. Run npm run typecheck.",
    "2. Run npm test.",
    "3. Run npm run rax -- eval.",
    "## Codex Prompt",
    "Patch provider-backed analyst behavior with focused tests and no authority expansion.",
    "## Evidence Required",
    "- npm run typecheck output.",
    "- npm test output.",
    "- npm run rax -- eval output."
  ].join("\n");
}

function validCodeReview(marker: string): string {
  return [
    "## Findings",
    `- ${marker}.`,
    "",
    "## Tests",
    "- Not run in this review.",
    "",
    "## Residual Risk",
    "- Repository diff evidence was not supplied."
  ].join("\n");
}

function validTestGapAudit(marker: string): string {
  return [
    "## Feature",
    `- ${marker}.`,
    "## Existing Tests",
    "- tests/governedIntelligence.test.ts covers provider-backed analyst behavior.",
    "## Missing Tests",
    "- Add redteam evals for weak evidence laundering.",
    "## Negative Cases Needed",
    "- Provider output missing required headings.",
    "## Eval Cases Needed",
    "- Redteam case for fake-complete hard proof.",
    "## Priority",
    "- high"
  ].join("\n");
}

function validPolicyDrift(marker: string): string {
  return [
    "## Policy Change",
    `- ${marker}.`,
    "## Drift Checks",
    "- Provider output remains validator-gated.",
    "## Violations",
    "- None identified from supplied input.",
    "## Required Evals",
    "- npm run rax -- eval --redteam",
    "## Approval Recommendation",
    "- Needs review with policy diff and eval output."
  ].join("\n");
}

function validModelComparison(marker: string): string {
  return [
    "## Task",
    `- ${marker}.`,
    "## STAX Answer Strengths",
    "- Names local proof boundaries.",
    "## External Answer Strengths",
    "- May provide alternate reasoning.",
    "## Evidence Comparison",
    "- No local proof artifact was supplied.",
    "## Evidence Decision",
    "- Decision: reasoned_opinion",
    "## Specificity Comparison",
    "- STAX answer is more specific when it names exact commands.",
    "## Actionability Comparison",
    "- Prefer bounded next action.",
    "## Missing Local Proof",
    "- Add local STAX command evidence.",
    "## Safer Answer",
    "- Use local evidence as the proof surface.",
    "## Better Answer For This Project",
    "- The better answer is evidence-linked.",
    "## Recommended Correction",
    "- Capture a correction candidate only after approval.",
    "## Recommended Eval",
    "- Add a paired comparison eval.",
    "## Recommended Prompt / Patch",
    "Implement only the missing locally proven behavior."
  ].join("\n");
}

function validAnalysis(marker: string): string {
  return [
    "## Facts Used",
    `- ${marker}.`,
    "## Pattern Candidates",
    "- Provider-backed analysis can add reasoning only after validation.",
    "## Deviations",
    "- None identified from supplied input.",
    "## Confidence",
    "- medium",
    "## Unknowns",
    "- Local proof remains required for repo claims."
  ].join("\n");
}
