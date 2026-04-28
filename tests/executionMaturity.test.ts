import { describe, expect, it } from "vitest";
import { ExecutionMaturity } from "../src/execution/ExecutionMaturity.js";

describe("ExecutionMaturity", () => {
  const maturity = new ExecutionMaturity();

  it("reports current STAX planning as level 2 or below", () => {
    const result = maturity.evaluate({ hasEvidenceRequest: true, hasPatchPlan: true });

    expect(result.currentLevel).toBe("level_2_patch_plan");
    expect(result.needed.join(" ")).toContain("sandbox");
  });

  it("requires sandbox patch for level 3", () => {
    const result = maturity.evaluate({ commandEvidencePassed: true });

    expect(result.currentLevel).toBe("level_3_sandbox_patch");
    expect(result.blockingReasons.join(" ")).toContain("sandbox patch");
  });

  it("requires command evidence for level 4", () => {
    const result = maturity.evaluate({ hasEvidenceRequest: true, hasPatchPlan: true, sandboxPatchApplied: true });

    expect(result.currentLevel).toBe("level_3_sandbox_patch");
    expect(result.nextLevel).toBe("level_4_sandbox_verified");
  });

  it("requires human approval for level 5", () => {
    const result = maturity.evaluate({ hasEvidenceRequest: true, hasPatchPlan: true, sandboxPatchApplied: true, commandEvidencePassed: true });

    expect(result.currentLevel).toBe("level_4_sandbox_verified");
    expect(result.needed.join(" ")).toContain("human approval");
  });
});
