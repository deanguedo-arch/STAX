import fs from "node:fs/promises";
import path from "node:path";
import {
  TestQualityAnalyzerInputSchema,
  TestQualityFixtureFileSchema,
  type ParsedTestQualityAnalyzerInput,
  type TestQualityAnalyzerInput,
  type TestQualityAnalyzerResult,
  type TestQualityFixtureCase,
  type TestQualityFindingId
} from "./TestQualityAnalyzerSchemas.js";

type Finding = TestQualityAnalyzerResult["findings"][number];

export function analyzeTestQuality(input: TestQualityAnalyzerInput): TestQualityAnalyzerResult {
  const parsed = TestQualityAnalyzerInputSchema.parse(input);
  const addedLines = parsed.patch
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
  const normalized = addedLines.join("\n").toLowerCase();
  const findings: Finding[] = [];

  const hasAssertion =
    /\b(expect|assert|to(be|equal|contain|match|have|strictEqual)|assertEquals|should\.)\b/i.test(addedLines.join("\n"));
  const hasSkipped = /\b(it|test)\.(skip|todo)\b|\bskip(ped)?\b/i.test(normalized);
  const hasSnapshotOnly =
    /\b(toMatchSnapshot|toMatchInlineSnapshot|snapshot)\b/i.test(addedLines.join("\n")) && !hasNonSnapshotAssertion(addedLines);
  const hasMockOnly =
    /\b(jest\.mock|vi\.mock|mockresolvedvalue|mockreturnvalue|stub\(|spyon)\b/i.test(normalized) &&
    !/\b(fetch|render|screen\.|userEvent|page\.goto|mount\(|request\(|supertest)\b/i.test(normalized);
  const hasFixtureGoldenMutation =
    /\b(golden|fixture|snapshot)\b/i.test(parsed.filePath) || /\b(golden|fixture|snapshot)\b/i.test(normalized);
  const hasIntegrationEvidence = /\b(render|screen\.|userEvent|page\.goto|supertest|request\(|mount\(|integration)\b/i.test(
    normalized
  );

  if (hasSkipped) {
    findings.push(finding("skipped_test", "critical", "Skipped or todo tests do not prove the behavior claim."));
  }

  if (!hasAssertion) {
    findings.push(finding("no_assertion", "critical", "The added test diff does not contain a meaningful assertion."));
  } else {
    findings.push(finding("meaningful_behavior_assertion", "info", "The added test diff includes an assertion."));
  }

  if (hasSnapshotOnly) {
    findings.push(finding("snapshot_only_risk", "warning", "Snapshot-only assertions can hide a behavior regression."));
  }

  if (hasMockOnly) {
    findings.push(finding("mock_only_coverage", "warning", "Mock-only coverage is limited proof for runtime behavior."));
  }

  if (hasFixtureGoldenMutation) {
    findings.push(finding("fixture_golden_mutation", "warning", "Fixture or golden mutations need extra review before counting as proof."));
  }

  if (hasIntegrationEvidence) {
    findings.push(finding("integration_evidence_present", "info", "The test diff includes integration-style behavior evidence."));
  }

  const criticalFindings = findings.filter((item) => item.severity === "critical").map((item) => item.id);
  const warningFindings = findings.filter((item) => item.severity === "warning").map((item) => item.id);

  const verdict =
    criticalFindings.length > 0 ? "reject" : warningFindings.length > 0 ? "provisional" : "accept";

  return {
    verdict,
    supportsBehaviorProof:
      verdict === "accept" ||
      (verdict === "provisional" && !warningFindings.includes("mock_only_coverage") && !warningFindings.includes("snapshot_only_risk")),
    supportsTestClaim: verdict !== "reject",
    findings
  };
}

export async function loadTestQualityFixtureCases(rootDir = process.cwd()): Promise<TestQualityFixtureCase[]> {
  const fixtureDir = path.join(rootDir, "fixtures", "test_quality");
  const files = (await fs.readdir(fixtureDir))
    .filter((file) => file.startsWith("test_quality_") && file.endsWith(".json"))
    .sort();
  const cases: TestQualityFixtureCase[] = [];
  for (const filename of files) {
    const raw = JSON.parse(await fs.readFile(path.join(fixtureDir, filename), "utf8")) as unknown;
    cases.push(...TestQualityFixtureFileSchema.parse(raw).cases);
  }
  return cases;
}

function finding(id: TestQualityFindingId, severity: Finding["severity"], message: string): Finding {
  return { id, severity, message };
}

function hasNonSnapshotAssertion(lines: string[]): boolean {
  return lines.some(
    (line) =>
      /\b(expect|assert|to(be|equal|contain|match|have|strictEqual)|assertEquals|should\.)\b/i.test(line) &&
      !/toMatchSnapshot|toMatchInlineSnapshot/i.test(line)
  );
}
