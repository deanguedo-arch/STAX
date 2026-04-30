import type { StaxCoreReleaseArtifact } from "./ReleaseArtifactWriter.js";
import type { DoctrineTrendReport, PromotionReadinessSummary } from "./DoctrineTrend.js";

export function renderReleaseMarkdownReport(args: {
  artifact: StaxCoreReleaseArtifact;
  artifactPath: string;
  trend: DoctrineTrendReport;
  promotion: PromotionReadinessSummary;
}): string {
  const { artifact, artifactPath, trend, promotion } = args;
  const latest = trend.latest;
  const previous = trend.previous;

  const commandLines =
    artifact.commandChecks.length > 0
      ? artifact.commandChecks
          .map(
            (check) =>
              `- ${check.name}: ${check.passed ? "pass" : "fail"} (${check.durationMs}ms)`
          )
          .join("\n")
      : "- dry-run evidence (no local command execution)";

  const trendLines =
    trend.entries.length > 0
      ? trend.entries
          .slice(0, 5)
          .map(
            (entry) =>
              `- ${entry.createdAt} | score ${entry.score} (${entry.grade}) | release ${
                entry.canRelease ? "pass" : "blocked"
              } | ${entry.path}`
          )
          .join("\n")
      : "- no prior artifacts";

  const blockers =
    promotion.blockers.length > 0
      ? promotion.blockers.map((item) => `- ${item}`).join("\n")
      : "- none";

  return [
    "# STAX Core Release Gate Report",
    "",
    `Generated: ${artifact.createdAt}`,
    `Artifact: ${artifactPath}`,
    `Doctrine Version: ${artifact.doctrineVersion}`,
    `Release Profile: ${artifact.releaseGate.profile ?? "standard"}`,
    "",
    "## Gate Status",
    `- Release Gate: ${artifact.releaseGate.canRelease ? "PASS" : "BLOCKED"}`,
    `- Doctrine Compliance: ${artifact.doctrineCompliance.score} (${artifact.doctrineCompliance.grade})`,
    `- Replay Deterministic: ${artifact.replay.deterministic ? "yes" : "no"}`,
    `- Replay Chain Valid: ${artifact.replay.chainValid ? "yes" : "no"}`,
    "",
    "## Command Checks",
    commandLines,
    "",
    "## Doctrine Trend",
    `- Latest Score: ${latest ? latest.score : "n/a"}`,
    `- Previous Score: ${previous ? previous.score : "n/a"}`,
    `- Delta: ${
      trend.scoreDeltaFromPrevious === null
        ? "n/a"
        : trend.scoreDeltaFromPrevious > 0
          ? `+${trend.scoreDeltaFromPrevious}`
          : trend.scoreDeltaFromPrevious
    }`,
    `- Regression Block: ${trend.regression.detected ? "yes" : "no"}`,
    "",
    "### Recent Artifacts",
    trendLines,
    "",
    "## Promotion Readiness",
    `- Can Promote: ${promotion.canPromote ? "yes" : "no"}`,
    `- Summary: ${promotion.summary}`,
    "",
    "### Blockers",
    blockers,
    "",
    "## Notes",
    artifact.doctrineCompliance.notes.length
      ? artifact.doctrineCompliance.notes.map((note) => `- ${note}`).join("\n")
      : "- none"
  ].join("\n");
}
