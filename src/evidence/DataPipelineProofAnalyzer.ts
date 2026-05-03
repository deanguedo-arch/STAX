import fs from "node:fs/promises";
import path from "node:path";
import {
  DataPipelineProofAnalyzerInputSchema,
  DataPipelineProofFixtureFileSchema,
  type DataPipelineProofAnalyzerInput,
  type DataPipelineProofAnalyzerResult,
  type DataPipelineProofFixtureCase,
  type DataPipelineProofFindingId
} from "./DataPipelineProofAnalyzerSchemas.js";

type Finding = DataPipelineProofAnalyzerResult["findings"][number];

export function analyzeDataPipelineProof(input: DataPipelineProofAnalyzerInput): DataPipelineProofAnalyzerResult {
  const parsed = DataPipelineProofAnalyzerInputSchema.parse(input);
  const findings: Finding[] = [];
  const text = `${parsed.task}\n${parsed.description}\n${parsed.blankRateNotes ?? ""}`.toLowerCase();

  if (parsed.validationPassed === true || /\bvalidation passed|validate-canonical|validate-dataset\b/.test(text)) {
    findings.push(finding("validation_present", "info", "Validation evidence is present."));
  } else {
    findings.push(finding("missing_validation", "critical", "No passing validation artifact was supplied."));
  }

  if (parsed.dryRunPassed === true || /\bdry-run|dry run|candidate diff\b/.test(text)) {
    findings.push(finding("dry_run_present", "info", "Dry-run evidence is present."));
  } else {
    findings.push(finding("missing_dry_run", "critical", "No dry-run artifact was supplied."));
  }

  if (parsed.rowCountBefore !== undefined || parsed.rowCountAfter !== undefined || /\brow-count|row count\b/.test(text)) {
    findings.push(finding("row_count_present", "info", "Row-count comparison evidence is present."));
  } else {
    findings.push(finding("missing_row_count_diff", "critical", "No row-count or candidate diff artifact was supplied."));
  }

  if (parsed.configKind === "example" || /sheets_sync\.json\.example|example config/.test(text)) {
    findings.push(finding("example_config_only", "critical", "Only example config evidence was supplied."));
  }

  if ((parsed.duplicateCount ?? 0) > 0) {
    findings.push(finding("duplicate_rows_detected", "warning", "Duplicate rows were detected in the data proof artifact."));
  }

  if ((parsed.unknownFieldCount ?? 0) > 0) {
    findings.push(finding("unknown_fields_detected", "warning", "Unknown fields were detected in the data proof artifact."));
  }

  if (parsed.blankRateNotes && /\bhigh|spike|suspicious|blank rate\b/.test(parsed.blankRateNotes.toLowerCase())) {
    findings.push(finding("suspicious_blank_rates", "warning", "Blank-rate notes indicate a suspicious data quality issue."));
  }

  const hasCritical = findings.some((finding) => finding.severity === "critical");
  const hasWarnings = findings.some((finding) => finding.severity === "warning");
  const verdict = hasCritical ? "reject" : hasWarnings ? "provisional" : "accept";

  return {
    verdict,
    findings,
    supportsDataClaim: verdict === "accept"
  };
}

export async function loadDataPipelineProofFixtureCases(rootDir = process.cwd()): Promise<DataPipelineProofFixtureCase[]> {
  const fixtureDir = path.join(rootDir, "fixtures", "data_pipeline_proof");
  const files = (await fs.readdir(fixtureDir))
    .filter((file) => file.startsWith("data_pipeline_proof_") && file.endsWith(".json"))
    .sort();
  const cases: DataPipelineProofFixtureCase[] = [];
  for (const filename of files) {
    const raw = JSON.parse(await fs.readFile(path.join(fixtureDir, filename), "utf8")) as unknown;
    cases.push(...DataPipelineProofFixtureFileSchema.parse(raw).cases);
  }
  return cases;
}

function finding(id: DataPipelineProofFindingId, severity: Finding["severity"], message: string): Finding {
  return { id, severity, message };
}
