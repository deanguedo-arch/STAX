import { loadPullRequestReviewCommentCases, scorePullRequestReviewComment } from "../src/projectControl/PullRequestReviewComment.js";

const cases = loadPullRequestReviewCommentCases();
const results = cases.map((input) => scorePullRequestReviewComment(input));

const summary = {
  caseCount: results.length,
  passedCount: results.filter((result) => result.passed).length,
  usefulCommentRate: results.length === 0 ? 0 : Math.round((results.filter((result) => result.passed).length / results.length) * 100),
  status: results.every((result) => result.passed) ? "passed" : "blocked",
  issues: results.filter((result) => !result.passed).map((result) => ({
    caseId: result.caseId,
    issues: result.issues
  }))
};

console.log(JSON.stringify(summary, null, 2));

if (summary.status !== "passed") {
  process.exitCode = 1;
}
