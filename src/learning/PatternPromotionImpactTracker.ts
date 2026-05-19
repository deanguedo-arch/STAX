import fs from "node:fs/promises";
import path from "node:path";
import { ensureDirectory, nowIso } from "../sidecar/SidecarRepo.js";
import { PatternPromotionGate } from "./PatternPromotionGate.js";
import {
  CurrentOperatingImpactResultSchema,
  LockedReplayImpactFixtureSchema,
  LockedReplayImpactResultSchema,
  PatternPromotionImpactReportSchema,
  StaxImpactEvidenceBundleSchema,
  type CurrentOperatingImpactResult,
  type LockedReplayImpactCase,
  type LockedReplayImpactFixture,
  type LockedReplayImpactResult,
  type PatternPromotionImpactOutcome,
  type PatternPromotionImpactReport,
  type StaxImpactEvidenceBundle
} from "./PatternPromotionImpactSchemas.js";
import type { PatternPromotionDecision } from "./PatternPromotionSchemas.js";

export type PatternPromotionImpactInput = {
  lockedReplayFixture?: LockedReplayImpactFixture;
  importedEvidenceBundles?: StaxImpactEvidenceBundle[];
  generatedAt?: string;
};

export type PatternPromotionImpactWriteResult = {
  report: PatternPromotionImpactReport;
  jsonPath: string;
  markdownPath: string;
};

export async function readLockedReplayImpactFixture(fixturePath: string): Promise<LockedReplayImpactFixture> {
  const raw = await fs.readFile(fixturePath, "utf8");
  return LockedReplayImpactFixtureSchema.parse(JSON.parse(raw) as unknown);
}

export async function readImpactEvidenceBundle(bundlePath: string): Promise<StaxImpactEvidenceBundle> {
  const raw = await fs.readFile(bundlePath, "utf8");
  return StaxImpactEvidenceBundleSchema.parse(JSON.parse(raw) as unknown);
}

export function buildPatternPromotionImpactReport(input: PatternPromotionImpactInput): PatternPromotionImpactReport {
  const lockedResults = (input.lockedReplayFixture?.cases ?? []).map((impactCase) => evaluateLockedReplayCase(impactCase));
  const operatingResults = (input.importedEvidenceBundles ?? []).map((bundle) => evaluateImportedEvidenceBundle(bundle));

  return PatternPromotionImpactReportSchema.parse({
    schemaVersion: "stax-pattern-promotion-impact-report-v1",
    generatedAt: input.generatedAt ?? nowIso(),
    lockedReplay: {
      claim: "Locked replay proves whether STAX behavior changed on frozen prompts and evidence.",
      caseCount: lockedResults.length,
      criticalMisses: lockedResults.filter((result) => result.criticalMiss).length,
      improved: lockedResults.filter((result) => result.outcome === "improved").length,
      unchangedSafe: lockedResults.filter((result) => result.outcome === "unchanged_safe").length,
      regressed: lockedResults.filter((result) => result.outcome === "regressed").length,
      results: lockedResults
    },
    currentOperatingWindow: {
      claim: "Current operating-window evidence proves whether STAX helps live repos today.",
      importedBundleCount: operatingResults.length,
      criticalMisses: operatingResults.filter((result) => result.criticalMiss).length,
      fullHandoffContracts: operatingResults.filter((result) => result.fullHandoffContractPresent).length,
      proofArtifactsRequested: operatingResults.filter((result) => result.proofArtifactRequested).length,
      cleanupPromptsNeeded: operatingResults.filter((result) => result.cleanupPromptNeeded).length,
      results: operatingResults
    }
  });
}

export async function writePatternPromotionImpactReport(options: {
  staxRoot?: string;
  lockedReplayFixture?: LockedReplayImpactFixture;
  importedEvidenceBundles?: StaxImpactEvidenceBundle[];
}): Promise<PatternPromotionImpactWriteResult> {
  const staxRoot = path.resolve(options.staxRoot ?? process.cwd());
  const report = buildPatternPromotionImpactReport({
    lockedReplayFixture: options.lockedReplayFixture,
    importedEvidenceBundles: options.importedEvidenceBundles
  });
  const docsPath = path.join(staxRoot, "docs", "RAX_PATTERN_PROMOTION_IMPACT_REPORT.md");
  const reportDir = path.join(staxRoot, "reports", "pattern_promotion");
  await ensureDirectory(reportDir);
  const jsonPath = path.join(reportDir, `pattern-promotion-impact-${report.generatedAt.replace(/[:.]/g, "-")}.json`);
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(docsPath, renderPatternPromotionImpactReport(report), "utf8");
  return { report, jsonPath, markdownPath: docsPath };
}

export function evaluateLockedReplayCase(impactCase: LockedReplayImpactCase): LockedReplayImpactResult {
  const gate = new PatternPromotionGate();
  const decision = gate.classify({
    candidateId: impactCase.caseId,
    text: impactCase.candidateText,
    sourceEventIds: impactCase.sourceEventIds,
    repeatCount: impactCase.repeatCount,
    severity: impactCase.severity,
    failureTypes: impactCase.failureTypes,
    explicitUserPreference: impactCase.explicitUserPreference,
    codeChangeBacked: impactCase.codeChangeBacked,
    testBacked: impactCase.testBacked,
    realRunBacked: impactCase.realRunBacked,
    reusableAcrossRepos: impactCase.reusableAcrossRepos,
    repoScoped: impactCase.repoScoped,
    humanApproved: impactCase.humanApproved
  });

  const failures = expectedDecisionFailures(decision, impactCase.expectedDecision);
  if (
    impactCase.expectedFutureBehaviorContains &&
    !decision.expectedFutureBehaviorChange.toLowerCase().includes(impactCase.expectedFutureBehaviorContains.toLowerCase())
  ) {
    failures.push(`future behavior missing: ${impactCase.expectedFutureBehaviorContains}`);
  }

  const criticalMiss = impactCase.criticalMiss || failures.length > 0;
  const baselineChanged = impactCase.baselineDecision
    ? expectedDecisionFailures(decisionFromExpected(impactCase.baselineDecision), impactCase.expectedDecision).length > 0
    : true;
  const outcome: PatternPromotionImpactOutcome = criticalMiss ? "regressed" : baselineChanged ? "improved" : "unchanged_safe";

  return LockedReplayImpactResultSchema.parse({
    caseId: impactCase.caseId,
    promotionId: impactCase.promotionId,
    outcome,
    criticalMiss,
    expectedClassification: impactCase.expectedDecision.classification,
    actualClassification: decision.classification,
    expectedAction: impactCase.expectedDecision.recommendedAction,
    actualAction: decision.recommendedAction,
    expectedTarget: impactCase.expectedDecision.promotionTarget,
    actualTarget: decision.promotionTarget,
    failures,
    futureBehaviorChange: decision.expectedFutureBehaviorChange
  });
}

export function evaluateImportedEvidenceBundle(bundle: StaxImpactEvidenceBundle): CurrentOperatingImpactResult {
  const failures: string[] = [];
  if (bundle.criticalMiss) failures.push("bundle records a critical miss");
  if (!bundle.fullHandoffContractPresent) failures.push("full handoff contract missing");
  if (!bundle.proofArtifactRequested) failures.push("proof artifact not requested");

  const outcome: PatternPromotionImpactOutcome = bundle.criticalMiss
    ? "regressed"
    : bundle.fullHandoffContractPresent && bundle.proofArtifactRequested
      ? "improved"
      : "unchanged_safe";

  return CurrentOperatingImpactResultSchema.parse({
    repo: bundle.repo.name,
    branch: bundle.repo.branch,
    head: bundle.repo.head,
    outcome,
    criticalMiss: bundle.criticalMiss,
    cleanupPromptNeeded: bundle.cleanupPromptNeeded,
    fullHandoffContractPresent: bundle.fullHandoffContractPresent,
    proofArtifactRequested: bundle.proofArtifactRequested,
    commandEvidenceCount: bundle.commandEvidence.length,
    artifactCount: bundle.artifacts.length,
    failures
  });
}

export function renderPatternPromotionImpactReport(report: PatternPromotionImpactReport): string {
  const locked = report.lockedReplay;
  const current = report.currentOperatingWindow;
  const lines = [
    "# Pattern Promotion Impact Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Claim Separation",
    "",
    `- Locked replay: ${locked.claim}`,
    `- Current operating window: ${current.claim}`,
    "- These claims are intentionally separate. Locked replay does not prove live repo usefulness, and imported live evidence does not prove deterministic replay behavior.",
    "",
    "## Locked Replay",
    "",
    `Status: ${locked.criticalMisses === 0 ? `${locked.caseCount} cases, 0 critical misses` : `${locked.criticalMisses} critical miss(es)`}`,
    `Improved: ${locked.improved}`,
    `Unchanged-safe: ${locked.unchangedSafe}`,
    `Regressed: ${locked.regressed}`,
    "",
    "### Locked Cases",
    ""
  ];

  for (const result of locked.results) {
    lines.push(
      `- ${result.caseId}: ${result.outcome}; ${result.actualClassification} -> ${result.actualAction} / ${result.actualTarget}; failures: ${
        result.failures.length ? result.failures.join("; ") : "none"
      }`
    );
  }

  lines.push(
    "",
    "## Current Operating Window Imports",
    "",
    `Status: ${current.importedBundleCount} imported bundle(s), ${current.criticalMisses} critical miss(es)`,
    `Full handoff contracts: ${current.fullHandoffContracts}/${current.importedBundleCount}`,
    `Proof artifacts requested: ${current.proofArtifactsRequested}/${current.importedBundleCount}`,
    `Cleanup prompts needed: ${current.cleanupPromptsNeeded}/${current.importedBundleCount}`,
    "",
    "### Imported Bundles",
    ""
  );

  if (current.results.length === 0) {
    lines.push("- none imported yet");
  } else {
    for (const result of current.results) {
      lines.push(
        `- ${result.repo}: ${result.outcome}; commands=${result.commandEvidenceCount}; artifacts=${result.artifactCount}; failures: ${
          result.failures.length ? result.failures.join("; ") : "none"
        }`
      );
    }
  }

  lines.push(
    "",
    "## Boundary",
    "",
    "This report does not inspect or mutate attached repos. Current operating-window claims require imported evidence bundles exported from the machine that has those repos.",
    ""
  );

  return `${lines.join("\n").trimEnd()}\n`;
}

function expectedDecisionFailures(
  decision: Pick<PatternPromotionDecision, "classification" | "recommendedAction" | "promotionTarget" | "promotable">,
  expected: LockedReplayImpactCase["expectedDecision"]
): string[] {
  const failures: string[] = [];
  if (decision.classification !== expected.classification) {
    failures.push(`classification expected ${expected.classification}, got ${decision.classification}`);
  }
  if (decision.recommendedAction !== expected.recommendedAction) {
    failures.push(`action expected ${expected.recommendedAction}, got ${decision.recommendedAction}`);
  }
  if (decision.promotionTarget !== expected.promotionTarget) {
    failures.push(`target expected ${expected.promotionTarget}, got ${decision.promotionTarget}`);
  }
  if (expected.promotable !== undefined && decision.promotable !== expected.promotable) {
    failures.push(`promotable expected ${expected.promotable}, got ${decision.promotable}`);
  }
  return failures;
}

function decisionFromExpected(
  expected: LockedReplayImpactCase["expectedDecision"]
): Pick<PatternPromotionDecision, "classification" | "recommendedAction" | "promotionTarget" | "promotable"> {
  return {
    classification: expected.classification,
    recommendedAction: expected.recommendedAction,
    promotionTarget: expected.promotionTarget,
    promotable: expected.promotable ?? false
  };
}
