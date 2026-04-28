import { describe, expect, it } from "vitest";
import { ExecutionLane } from "../src/execution/ExecutionLane.js";

describe("ExecutionLane", () => {
  const lane = new ExecutionLane();

  it("rejects direct linked repo mutation", () => {
    const result = lane.evaluate({ requestedStatus: "patch_applied_to_sandbox", directLinkedRepoMutation: true, humanApprovedSandbox: true, sandboxPath: "/tmp/sandbox" });

    expect(result.allowed).toBe(false);
    expect(result.blockingReasons.join(" ")).toContain("Direct linked-repo mutation");
  });

  it("allows sandbox patch after approval", () => {
    const result = lane.evaluate({ requestedStatus: "patch_applied_to_sandbox", humanApprovedSandbox: true, sandboxPath: "/tmp/sandbox" });

    expect(result.allowed).toBe(true);
    expect(result.status).toBe("patch_applied_to_sandbox");
  });

  it("blocks ready state when commands fail", () => {
    const result = lane.evaluate({
      requestedStatus: "ready_for_human_apply",
      humanApprovedSandbox: true,
      sandboxPath: "/tmp/sandbox",
      patchAppliedToSandbox: true,
      commandExitCodes: [0, 1],
      humanApprovedRealApply: true
    });

    expect(result.allowed).toBe(false);
    expect(result.blockingReasons.join(" ")).toContain("Passing sandbox command evidence");
  });

  it("still requires separate human approval before real apply", () => {
    const result = lane.evaluate({
      requestedStatus: "ready_for_human_apply",
      humanApprovedSandbox: true,
      sandboxPath: "/tmp/sandbox",
      patchAppliedToSandbox: true,
      commandExitCodes: [0]
    });

    expect(result.allowed).toBe(false);
    expect(result.requiredNextApproval).toContain("real apply");
  });
});
