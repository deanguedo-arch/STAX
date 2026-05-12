import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("limited hard gate policy artifacts", () => {
  it("limits hard gate to protected boundaries", () => {
    const boundaryPolicy = fs.readFileSync(path.join(process.cwd(), "docs/releases/LIMITED_HARD_GATE/boundary_policy.md"), "utf8");

    expect(boundaryPolicy).toContain("protected boundaries");
    expect(boundaryPolicy).toContain("does not block ordinary local editing");
    expect(boundaryPolicy).toContain("stale command evidence");
    expect(boundaryPolicy).toContain("wrong-worktree command evidence");
  });

  it("documents approval limits and non-activation", () => {
    const overridePolicy = fs.readFileSync(path.join(process.cwd(), "docs/releases/LIMITED_HARD_GATE/override_policy.md"), "utf8");
    const trialReport = fs.readFileSync(path.join(process.cwd(), "docs/releases/LIMITED_HARD_GATE/trial_report.md"), "utf8");
    const releaseTrial = fs.readFileSync(path.join(process.cwd(), "docs/releases/LIMITED_HARD_GATE/release_like_preflight_trial.md"), "utf8");

    expect(overridePolicy).toContain("Hard gate does not accept a free-form bypass");
    expect(overridePolicy).toContain("approval schema is recognized");
    expect(trialReport).toContain("Status: passed");
    expect(trialReport).toContain("No hard-gate protected boundary has been activated");
    expect(releaseTrial).toContain("Status: passed");
    expect(releaseTrial).toContain("git push --tags");
    expect(releaseTrial).toContain("does not enable a live blocking switch");
  });
});
