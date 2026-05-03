import { validatePrReviewCommentGate } from "../src/campaign/PrReviewCommentGate.js";

async function main(): Promise<void> {
  const summary = await validatePrReviewCommentGate();
  console.log(
    JSON.stringify(
      {
        caseCount: summary.caseCount,
        passedCount: summary.passingCount,
        usefulCommentRate: summary.usefulCommentRate,
        status: summary.status,
        issues: summary.issues
      },
      null,
      2
    )
  );

  if (summary.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
