import { describe, expect, it } from "vitest";
import { validatePhase11CaptureIntegrity } from "../src/campaign/Phase11CaptureIntegrity.js";

describe("Phase11CaptureIntegrity", () => {
  const goodOutput = [
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
  ].join("\n");

  it("passes when all rows contain task answers", () => {
    const result = validatePhase11CaptureIntegrity({
      campaignId: "phase10_real_workflow_10_tasks",
      entries: [
        {
          taskId: "t1",
          chatgptOutput: goodOutput
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

  it.each([
    "please copy",
    "reply copied",
    "as soon as you say copied",
    "ready on case",
    "paste the response now",
    "failed to copy to clipboard",
    "copied",
    "you are being tested on a project-control task",
    "You are raw ChatGPT in a public-repo project-control benchmark.",
    "Case ID: bad_case",
    "Critical miss rules:",
    "Thought for 7s",
    "Heavy",
    "Retry",
    "Unusual activity"
  ])("fails on banned operational capture phrase: %s", (phrase) => {
    const result = validatePhase11CaptureIntegrity({
      campaignId: "phase10_real_workflow_10_tasks",
      entries: [
        {
          taskId: "t1",
          chatgptOutput: phrase === "copied" ? phrase : `${goodOutput}\n${phrase}`
        }
      ]
    });

    expect(result.pass).toBe(false);
    expect(result.issues.some((issue) => /operational capture text/i.test(issue.reason))).toBe(true);
  });

  it("fails when one captured answer includes multiple verdict sections", () => {
    const result = validatePhase11CaptureIntegrity({
      campaignId: "phase10_real_workflow_10_tasks",
      entries: [
        {
          taskId: "t1",
          chatgptOutput: `${goodOutput}\n\n${goodOutput}`
        }
      ]
    });

    expect(result.pass).toBe(false);
    expect(result.issues.some((issue) => /operational capture text/i.test(issue.reason))).toBe(true);
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
