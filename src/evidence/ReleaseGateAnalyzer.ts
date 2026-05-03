import fs from "node:fs/promises";
import path from "node:path";
import {
  ReleaseGateAnalyzerInputSchema,
  ReleaseGateFixtureFileSchema,
  type ReleaseGateAnalyzerInput,
  type ReleaseGateAnalyzerResult,
  type ReleaseGateFixtureCase,
  type ReleaseGateFindingId
} from "./ReleaseGateAnalyzerSchemas.js";

type Finding = ReleaseGateAnalyzerResult["findings"][number];

export function analyzeReleaseGate(input: ReleaseGateAnalyzerInput): ReleaseGateAnalyzerResult {
  const parsed = ReleaseGateAnalyzerInputSchema.parse(input);
  const findings: Finding[] = [];
  const text = `${parsed.task}\n${parsed.description}\n${parsed.rollbackPlan ?? ""}\n${parsed.targetEnvironment ?? ""}`.toLowerCase();

  const buildPresent = parsed.buildPassed === true || /\bbuild passed|build succeeded|release build ok|pages build ok\b/.test(text);
  if (buildPresent) {
    findings.push(finding("build_proof_present", "info", "Build proof is present."));
  } else {
    findings.push(finding("missing_build_proof", "critical", "No passing build artifact was supplied."));
  }

  const targetPresent = parsed.targetValidated === true || /\btarget validated|target sheet confirmed|staging target confirmed|environment validated\b/.test(text);
  if (targetPresent) {
    findings.push(finding("target_environment_present", "info", "Target environment proof is present."));
  } else {
    findings.push(finding("missing_target_environment", "critical", "No target environment validation artifact was supplied."));
  }

  const rollbackPresent = parsed.rollbackValidated === true || Boolean(parsed.rollbackPlan?.trim()) || /\brollback|revert plan|rollback tested\b/.test(text);
  if (rollbackPresent) {
    findings.push(finding("rollback_plan_present", "info", "Rollback or revert proof is present."));
  } else {
    findings.push(finding("missing_rollback_plan", "critical", "No rollback or revert plan was supplied."));
  }

  const stagingPresent = parsed.stagingValidated === true || /\bstaging validated|staging smoke|preprod smoke|testflight build verified\b/.test(text);
  if (stagingPresent) {
    findings.push(finding("staging_validation_present", "info", "Staging or pre-release validation is present."));
  } else {
    findings.push(finding("missing_staging_validation", "warning", "No staging or pre-release validation artifact was supplied."));
  }

  const authSigningPresent = parsed.authSigningReady === true || /\bsigning ready|credentials verified|auth ready|release signing ok\b/.test(text);
  if (authSigningPresent) {
    findings.push(finding("auth_signing_present", "info", "Auth/signing readiness evidence is present."));
  } else {
    findings.push(finding("missing_auth_signing", "warning", "No auth or signing readiness artifact was supplied."));
  }

  if (parsed.checklistOnly === true || /release checklist only|todo checklist|checklist only/.test(text)) {
    findings.push(finding("checklist_only", "critical", "Checklist-only evidence cannot prove release readiness."));
  }

  const hasCritical = findings.some((finding) => finding.severity === "critical");
  const hasWarnings = findings.some((finding) => finding.severity === "warning");
  const verdict = hasCritical ? "reject" : hasWarnings ? "provisional" : "accept";

  return {
    verdict,
    findings,
    supportsReleaseClaim: verdict === "accept"
  };
}

export async function loadReleaseGateFixtureCases(rootDir = process.cwd()): Promise<ReleaseGateFixtureCase[]> {
  const fixtureDir = path.join(rootDir, "fixtures", "release_gate_proof");
  const files = (await fs.readdir(fixtureDir))
    .filter((file) => file.startsWith("release_gate_proof_") && file.endsWith(".json"))
    .sort();
  const cases: ReleaseGateFixtureCase[] = [];
  for (const filename of files) {
    const raw = JSON.parse(await fs.readFile(path.join(fixtureDir, filename), "utf8")) as unknown;
    cases.push(...ReleaseGateFixtureFileSchema.parse(raw).cases);
  }
  return cases;
}

function finding(id: ReleaseGateFindingId, severity: Finding["severity"], message: string): Finding {
  return { id, severity, message };
}
