import { describe, expect, it } from "vitest";
import { auditPullRequestArtifact } from "../src/projectControl/PullRequestArtifactAudit.js";

describe("pull request artifact audit", () => {
  it("rejects docs-only implementation claims in PR artifacts", () => {
    const result = auditPullRequestArtifact({
      task: "Audit whether this implementation fix is proven.",
      packet: {
        prNumber: 42,
        title: "Document project-control rollout",
        body: "Docs refresh only.",
        repo: "/Users/deanguedo/Documents/GitHub/STAX",
        branch: "main",
        commitSha: "abc1234",
        changedFiles: ["docs/STAX_9_5_PROMOTION_REPORT.md"],
        unifiedDiff: [
          "diff --git a/docs/STAX_9_5_PROMOTION_REPORT.md b/docs/STAX_9_5_PROMOTION_REPORT.md",
          "--- a/docs/STAX_9_5_PROMOTION_REPORT.md",
          "+++ b/docs/STAX_9_5_PROMOTION_REPORT.md",
          "@@ -1 +1 @@",
          "-old",
          "+new"
        ].join("\n"),
        ciStatuses: [],
        reviewComments: [],
        issueLinks: [],
        labels: []
      }
    });

    expect(result.verdict).toBe("reject");
    expect(result.unverified.join("\n")).toContain("docs_only_implementation_claim");
  });

  it("flags stale or wrong-commit CI proof", () => {
    const result = auditPullRequestArtifact({
      task: "Audit whether behavior is proven.",
      expectedCommitSha: "new1234",
      packet: {
        prNumber: 52,
        title: "Fix behavior path",
        body: "Behavior fix.",
        repo: "/Users/deanguedo/Documents/GitHub/STAX",
        branch: "main",
        commitSha: "new1234",
        changedFiles: ["src/agents/AnalystAgent.ts", "tests/projectControlMode.test.ts"],
        ciStatuses: [
          {
            workflow: "test",
            status: "success",
            branch: "main",
            commitSha: "old1234",
            summary: "workflow completed successfully",
            failedJobCount: 0,
            cancelledJobCount: 0,
            skippedJobCount: 0
          }
        ],
        reviewComments: [],
        issueLinks: [],
        labels: []
      }
    });

    expect(result.unverified.join("\n")).toContain("stale_proof");
  });

  it("marks partial matrix CI as unverified rather than clean proof", () => {
    const result = auditPullRequestArtifact({
      task: "Audit whether behavior is proven.",
      expectedCommitSha: "new1234",
      packet: {
        prNumber: 53,
        title: "Fix behavior path",
        body: "Behavior fix.",
        repo: "/Users/deanguedo/Documents/GitHub/STAX",
        branch: "main",
        commitSha: "new1234",
        changedFiles: ["src/agents/AnalystAgent.ts", "tests/projectControlMode.test.ts"],
        ciStatuses: [
          {
            workflow: "test",
            status: "success",
            branch: "main",
            commitSha: "new1234",
            summary: "workflow completed successfully",
            expectedJobCount: 4,
            completedJobCount: 3,
            failedJobCount: 1,
            cancelledJobCount: 0,
            skippedJobCount: 0
          }
        ],
        reviewComments: [],
        issueLinks: [],
        labels: []
      }
    });

    expect(result.unverified.join("\n")).toContain("partial_local_proof");
    expect(result.risk.join("\n")).toContain("partially complete");
  });

  it("keeps unresolved review comments in human-review lane", () => {
    const result = auditPullRequestArtifact({
      task: "Audit whether this implementation fix is proven.",
      packet: {
        prNumber: 61,
        title: "Tighten project-control validator",
        body: "Includes tests and proof notes.",
        repo: "/Users/deanguedo/Documents/GitHub/STAX",
        branch: "main",
        commitSha: "abc9876",
        changedFiles: ["src/validators/ProjectControlValidator.ts", "tests/projectControlMode.test.ts"],
        ciStatuses: [],
        reviewComments: [{ body: "Please verify the edge case.", state: "open" }],
        issueLinks: [],
        labels: []
      }
    });

    expect(result.verdict).toBe("human_review");
    expect(result.weak.join("\n")).toContain("review comment remains open");
  });
});
