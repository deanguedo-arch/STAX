import { describe, expect, it } from "vitest";
import { loadPullRequestReviewCommentCases, scorePullRequestReviewComment } from "../src/projectControl/PullRequestReviewComment.js";

describe("pull request review comments", () => {
  it("passes the fixture gate", () => {
    const cases = loadPullRequestReviewCommentCases();
    expect(cases).toHaveLength(15);

    const results = cases.map((input) => scorePullRequestReviewComment(input));
    expect(results.every((result) => result.passed)).toBe(true);
  });

  it("forbids broad approval language", () => {
    const [first] = loadPullRequestReviewCommentCases().filter((testCase) => testCase.caseId === "pr_comment_wrong_commit");
    const result = scorePullRequestReviewComment(first);
    expect(result.comment.toLowerCase()).not.toContain("lgtm");
    expect(result.comment.toLowerCase()).not.toContain("ship it");
  });
});
