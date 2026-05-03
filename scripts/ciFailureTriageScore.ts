import { validateCiFailureTriageGate } from "../src/campaign/CiFailureTriageGate.js";

async function main(): Promise<void> {
  const summary = await validateCiFailureTriageGate();

  process.stdout.write(
    `${JSON.stringify(
      {
        caseCount: summary.caseCount,
        passingCount: summary.passingCount,
        likelyCauseAccuracyPct: summary.likelyCauseAccuracyPct,
        proofStrengthAccuracyPct: summary.proofStrengthAccuracyPct,
        nextActionAccuracyPct: summary.nextActionAccuracyPct,
        status: summary.status,
        issues: summary.issues
      },
      null,
      2
    )}\n`
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
