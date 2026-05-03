import { loadPullRequestReviewCommentCases, scorePullRequestReviewComment } from "../projectControl/PullRequestReviewComment.js";

export type PrReviewCommentGateSummary = {
  caseCount: number;
  passingCount: number;
  usefulCommentRate: number;
  status: "passed" | "blocked";
  issues: string[];
};

export async function validatePrReviewCommentGate(): Promise<PrReviewCommentGateSummary> {
  const cases = loadPullRequestReviewCommentCases();
  const results = cases.map((input) => scorePullRequestReviewComment(input));

  const passingCount = results.filter((result) => result.passed).length;
  const usefulCommentRate = results.length === 0 ? 0 : Math.round((passingCount / results.length) * 100);
  const issues = results.flatMap((result) =>
    result.passed ? [] : [`${result.caseId}: ${result.issues.join(", ")}`]
  );

  return {
    caseCount: results.length,
    passingCount,
    usefulCommentRate,
    status: issues.length === 0 ? "passed" : "blocked",
    issues
  };
}
