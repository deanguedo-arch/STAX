import path from "node:path";
import { auditEvalFixtures } from "../src/evals/EvalFixtureAudit.js";

async function main(): Promise<void> {
  const summary = await auditEvalFixtures();
  const status = summary.issueCount === 0 ? "passed" : "blocked";
  process.stdout.write(
    `${JSON.stringify(
      {
        checkedFiles: summary.checkedFiles,
        issueCount: summary.issueCount,
        status,
        issues: summary.issues.map((issue) => ({
          file: path.relative(process.cwd(), issue.file),
          fixtureId: issue.fixtureId,
          message: issue.message
        }))
      },
      null,
      2
    )}\n`
  );
  if (summary.issueCount > 0) process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
