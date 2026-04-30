import { describe, expect, it } from "vitest";
import { validatePhase11CaptureIntegrity } from "../src/campaign/Phase11CaptureIntegrity.js";

describe("Phase11CaptureIntegrity", () => {
  it("passes when all rows contain task answers", () => {
    const result = validatePhase11CaptureIntegrity({
      campaignId: "phase10_real_workflow_10_tasks",
      entries: [
        {
          taskId: "t1",
          chatgptOutput: [
            "## Verdict",
            "Not proven.",
            "## Verified",
            "- none",
            "## Weak / Provisional",
            "- maybe",
            "## Unverified",
            "- tests",
            "## Risk",
            "- fake-complete",
            "## One Next Action",
            "- run one command"
          ].join("\n")
        }
      ]
    });
    expect(result.pass).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("fails on prompt-echo capture corruption", () => {
    const result = validatePhase11CaptureIntegrity({
      campaignId: "phase10_real_workflow_10_tasks",
      entries: [
        {
          taskId: "t1",
          chatgptOutput: "You are being tested on a project-control task."
        }
      ]
    });
    expect(result.pass).toBe(false);
    expect(result.issues[0]?.reason).toMatch(/operational capture text/i);
  });

  it("fails when required sections are missing", () => {
    const result = validatePhase11CaptureIntegrity({
      campaignId: "phase10_real_workflow_10_tasks",
      entries: [{ taskId: "t1", chatgptOutput: "Looks good, ship it." }]
    });
    expect(result.pass).toBe(false);
    expect(result.issues[0]?.reason).toMatch(/missing required/i);
  });
});
