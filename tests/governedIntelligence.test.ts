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
    const critic = new ScriptedProvider(() => [
      "## Critic Review",
      "- Pass/Fail: Fail",
      "- Issues Found: unsupported completion claim",
      "- Required Fixes: remove fake-complete language",
      "- Confidence: high"
    ].join("\n"));
    const runtime = await createDefaultRuntime({
      rootDir,
      provider: generator,
      roleProviders: { critic }
    });

    const output = await runtime.run("Plan critic adversary handling.", [], { mode: "planning" });

    expect(output.output).toContain("## Critic Failure");
    expect(output.output).toContain("Model critic failure");
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
