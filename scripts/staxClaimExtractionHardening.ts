import { writeClaimExtractionHardeningArtifacts } from "../src/sidecar/ClaimExtractionHardening.js";

async function main(): Promise<void> {
  const result = await writeClaimExtractionHardeningArtifacts();
  process.stdout.write(
    [
      `Fixture set: ${result.fixtureSet}`,
      `Total cases: ${result.totalCases}`,
      `High-risk false negatives: ${result.highRiskFalseNegatives}`,
      `False positive rate: ${result.falsePositiveRate}`,
      `Unsupported claim accepts: ${result.unsupportedClaimAccepts}`,
      `Status: ${result.passed ? "pass" : "fail"}`,
      "Results: fixtures/stax_trials/claim_evasion_results.json",
      "Report: docs/releases/CLAIM_EXTRACTION_HARDENING/report.md",
      "Allowed phrasing: docs/releases/CLAIM_EXTRACTION_HARDENING/allowed_phrasing.md"
    ].join("\n")
  );
  process.stdout.write("\n");
  if (!result.passed) process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
