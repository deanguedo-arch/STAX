import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decomposeClaimsFromReport } from "../src/claims/ClaimProofMapping.js";
import { matchProofSurface } from "../src/projectControl/ProofSurfaceMatcher.js";
import { ProofSurfacePackSchema, type ProofSurfacePack } from "../src/projectControl/ProofSurfacePackSchemas.js";

type OperatingWindowFixture = {
  schemaVersion: "stax-operating-window-smoke-v1";
  description: string;
  cases: OperatingWindowCase[];
};

type OperatingWindowCase = {
  id: string;
  repo: string;
  packPath: string;
  reportText: string;
  expectedClaimTypes: string[];
  expectedSurface: string;
  expectedBlockedEvidence: string[];
  nextActionContains: string[];
};

type OperatingWindowResult = {
  id: string;
  repo: string;
  status: "pass" | "fail";
  extractedClaims: string[];
  matchedSurface?: string;
  matchReason?: string;
  boundedNextAction?: string;
  failures: string[];
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(rootDir, "fixtures", "real_use", "operating_window_today_5_tasks.json");
const reportPath = path.join(rootDir, "docs", "RAX_OPERATING_WINDOW_TODAY_REPORT.md");

async function main(): Promise<void> {
  const fixture = JSON.parse(await fs.readFile(fixturePath, "utf8")) as OperatingWindowFixture;
  const results: OperatingWindowResult[] = [];

  for (const smokeCase of fixture.cases) {
    const pack = await readPack(smokeCase.packPath);
    results.push(evaluateCase(smokeCase, pack));
  }

  const failed = results.filter((result) => result.status === "fail");
  await fs.writeFile(reportPath, renderReport(fixture, results), "utf8");
  process.stdout.write(
    `${JSON.stringify(
      {
        total: results.length,
        passed: results.length - failed.length,
        criticalMisses: failed.length,
        reportPath
      },
      null,
      2
    )}\n`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

async function readPack(relativePath: string): Promise<ProofSurfacePack> {
  const raw = await fs.readFile(path.join(rootDir, relativePath), "utf8");
  return ProofSurfacePackSchema.parse(JSON.parse(raw) as unknown);
}

function evaluateCase(smokeCase: OperatingWindowCase, pack: ProofSurfacePack): OperatingWindowResult {
  const failures: string[] = [];
  const claims = decomposeClaimsFromReport(smokeCase.reportText);
  const extractedClaims = claims.map((claim) => claim.claimType);
  const match = matchProofSurface({ pack, text: smokeCase.reportText, claimTypes: extractedClaims });
  const surface = match?.surface;

  for (const expectedClaim of smokeCase.expectedClaimTypes) {
    if (!extractedClaims.includes(expectedClaim)) failures.push(`missing extracted claim: ${expectedClaim}`);
  }
  if (!surface) {
    failures.push(`missing proof surface: ${smokeCase.expectedSurface}`);
  } else {
    for (const blockedEvidence of smokeCase.expectedBlockedEvidence) {
      if (!surface.blockedEvidence.includes(blockedEvidence)) failures.push(`missing blocked evidence: ${blockedEvidence}`);
    }
    const nextAction = surface.nextAction ?? "";
    for (const expectedText of smokeCase.nextActionContains) {
      if (!nextAction.toLowerCase().includes(expectedText.toLowerCase())) failures.push(`next action missing: ${expectedText}`);
    }
    if (/\bchatgpt superiority|autonomous agent|deploy now|publish now|sync now\b/i.test(nextAction)) {
      failures.push("next action contains a forbidden broad or live-action claim");
    }
  }

  return {
    id: smokeCase.id,
    repo: smokeCase.repo,
    status: failures.length === 0 ? "pass" : "fail",
    extractedClaims,
    matchedSurface: surface?.claimType,
    matchReason: match?.reason,
    boundedNextAction: surface?.nextAction,
    failures
  };
}

function renderReport(fixture: OperatingWindowFixture, results: OperatingWindowResult[]): string {
  const failed = results.filter((result) => result.status === "fail");
  const lines = [
    "# Operating Window Today Report",
    "",
    `Status: ${failed.length === 0 ? "5/5 zero critical misses" : `${failed.length} critical miss(es)`}.`,
    "",
    fixture.description,
    "",
    "## Cases",
    ""
  ];

  for (const result of results) {
    lines.push(`### ${result.id}`);
    lines.push("");
    lines.push(`- Repo: ${result.repo}`);
    lines.push(`- Status: ${result.status}`);
    lines.push(`- Extracted claims: ${result.extractedClaims.length > 0 ? result.extractedClaims.join(", ") : "none"}`);
    lines.push(`- Matched proof surface: ${result.matchedSurface ?? "none"}`);
    lines.push(`- Match reason: ${result.matchReason ?? "none"}`);
    lines.push(`- One bounded next action: ${result.boundedNextAction ?? "none"}`);
    lines.push(`- Failures: ${result.failures.length > 0 ? result.failures.join("; ") : "none"}`);
    lines.push("");
  }

  lines.push("## Boundary");
  lines.push("");
  lines.push("This smoke does not run live repo commands, mutate target repos, deploy, publish, sync, or claim broad superiority. It proves the current proof-surface and claim-routing behavior for these five adversarial operating-window cases.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
