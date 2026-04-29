import { describe, expect, it } from "vitest";
import { defaultCapabilityRegistry } from "../src/capabilities/CapabilityRegistry.js";

describe("CapabilityRegistry", () => {
  it("declares high-risk write and execute capabilities as disabled by default", () => {
    const registry = defaultCapabilityRegistry();

    expect(registry.get("shell.execute")?.enabledByDefault).toBe(false);
    expect(registry.get("file.write")?.requiresApproval).toBe(true);
    expect(registry.get("git.mutate")?.riskLevel).toBe("critical");
  });

  it("blocks shell execution without approval and command evidence artifact", () => {
    const registry = defaultCapabilityRegistry();

    expect(registry.decide({ capabilityId: "shell.execute", context: "local_stax" }).allowed).toBe(false);
    expect(
      registry.decide({
        capabilityId: "shell.execute",
        context: "local_stax",
        approved: true
      }).reason
    ).toContain("artifact");
  });

  it("allows sandbox patch only with approval, artifact, and rollback plan", () => {
    const registry = defaultCapabilityRegistry();

    const allowed = registry.decide({
      capabilityId: "sandbox.patch_window",
      context: "sandbox",
      approved: true,
      artifactPath: "runs/example/patch.diff",
      rollbackPlan: "Discard sandbox copy."
    });

    expect(allowed.allowed).toBe(true);
  });

  it("blocks capabilities in undeclared contexts", () => {
    const registry = defaultCapabilityRegistry();

    const decision = registry.decide({
      capabilityId: "sandbox.command_window",
      context: "linked_repo",
      approved: true,
      artifactPath: "runs/example/stdout.txt"
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("linked_repo");
  });
});
