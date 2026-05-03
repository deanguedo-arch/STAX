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
            provider: "github_checks",
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
            provider: "github_checks",
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

  it("surfaces explicit CI proof strength when CI artifacts are missing", () => {
    const result = auditPullRequestArtifact({
      task: "Audit whether this implementation fix is proven.",
      packet: {
        prNumber: 63,
        title: "Fix parser edge case",
        body: "Implements behavior fix without attached CI output.",
        repo: "/Users/deanguedo/Documents/GitHub/STAX",
        branch: "main",
        commitSha: "abc0001",
        changedFiles: ["src/agents/AnalystAgent.ts", "tests/projectControlMode.test.ts"],
        ciStatuses: [],
        reviewComments: [],
        issueLinks: [],
        labels: []
      }
    });

    expect(result.weak.join("\n")).toContain("PR CI unavailable: partial_local_proof.");
    expect(result.risk.join("\n")).toContain("no workflow or command-status artifact");
  });

  it("surfaces workflow-run matrix evidence and retry risk from PR packets", () => {
    const result = auditPullRequestArtifact({
      task: "Audit whether this behavior fix is proven.",
      expectedCommitSha: "new1234",
      packet: {
        prNumber: 72,
        title: "Fix behavior path",
        body: "Behavior fix.",
        repo: "/Users/deanguedo/Documents/GitHub/STAX",
        branch: "main",
        commitSha: "new1234",
        changedFiles: ["src/agents/AnalystAgent.ts", "tests/projectControlMode.test.ts"],
        unifiedDiff: [
          "diff --git a/src/agents/AnalystAgent.ts b/src/agents/AnalystAgent.ts",
          "--- a/src/agents/AnalystAgent.ts",
          "+++ b/src/agents/AnalystAgent.ts",
          "@@ -1 +1 @@",
          "-export function oldHandler() {}",
          "+export function newHandler() {}"
        ].join("\n"),
        ciStatuses: [
          {
            workflow: "CI",
            provider: "github_actions",
            status: "success",
            branch: "main",
            commitSha: "new1234",
            runId: 77,
            runUrl: "https://github.com/example/repo/actions/runs/77",
            attempt: 2,
            eventName: "pull_request",
            summary: "2 job(s) | https://github.com/example/repo/actions/runs/77",
            expectedJobCount: 2,
            completedJobCount: 2,
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

    expect(result.weak.join("\n")).toContain("ci_proof");
    expect(result.risk.join("\n")).not.toContain("partially complete");
  });
});
