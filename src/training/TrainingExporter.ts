import fs from "node:fs/promises";
import path from "node:path";
import { TrainingExportRecordSchema } from "../schemas/zodSchemas.js";

export type ExportResult = {
  path: string;
  count: number;
};

async function listMarkdown(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((entry) => entry.endsWith(".md")).map((entry) => path.join(dir, entry));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function listJson(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((entry) => entry.endsWith(".json")).map((entry) => path.join(dir, entry));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

type ApprovedCorrection = {
  correctionId: string;
  runId: string;
  originalOutput: string;
  correctedOutput: string;
  reason: string;
  errorType: string;
  approved: boolean;
  promoteToTraining?: boolean;
  policyViolated?: string;
};

export class TrainingExporter {
  constructor(private rootDir = process.cwd()) {}

  async exportSft(): Promise<ExportResult> {
    const files = await listMarkdown(path.join(this.rootDir, "goldens"));
    const outputDir = path.join(this.rootDir, "training", "exports");
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, "sft.jsonl");
    const lines: string[] = [];

    for (const file of files) {
      const content = await fs.readFile(file, "utf8");
      const record = {
          messages: [
            { role: "system", content: "compiled policy bundle" },
            { role: "user", content: path.basename(file, ".md").replaceAll("_", " ") },
            { role: "assistant", content }
          ],
          metadata: {
            mode: inferMode(file),
            policiesApplied: ["core_policy@1.0.0", "evidence_policy@1.0.0"],
            source: "golden",
            runId: null
          }
        };
      TrainingExportRecordSchema.parse(record);
      lines.push(JSON.stringify(record));
    }

    for (const correction of await this.approvedCorrections()) {
      if (!correction.correctedOutput.trim()) continue;
      const record = {
        messages: [
          { role: "system", content: "compiled policy bundle" },
          { role: "user", content: correction.reason },
          { role: "assistant", content: correction.correctedOutput }
        ],
        metadata: {
          mode: "analysis",
          policiesApplied: correction.policyViolated ? [`${correction.policyViolated}@1.0.0`] : [],
          source: "correction",
          runId: correction.runId,
          errorType: correction.errorType
        }
      };
      TrainingExportRecordSchema.parse(record);
      lines.push(JSON.stringify(record));
    }

    await fs.writeFile(outputPath, lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
    return { path: outputPath, count: lines.length };
  }

  async exportPreference(): Promise<ExportResult> {
    const outputDir = path.join(this.rootDir, "training", "exports");
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, "preference.jsonl");
    const lines: string[] = [];

    for (const correction of await this.approvedCorrections()) {
      if (!correction.correctedOutput.trim() || !correction.originalOutput.trim()) continue;
      const record = {
            prompt: correction.reason,
            chosen: correction.correctedOutput,
            rejected: correction.originalOutput,
            reason: "chosen follows correction policy",
            metadata: {
              mode: "analysis",
              source: "correction",
              errorType: correction.errorType
            }
          };
      TrainingExportRecordSchema.parse(record);
      lines.push(JSON.stringify(record));
    }

    await fs.writeFile(outputPath, lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
    return { path: outputPath, count: lines.length };
  }

  private async approvedCorrections(): Promise<ApprovedCorrection[]> {
    const correctionFiles = await listJson(path.join(this.rootDir, "corrections", "approved"));
    const corrections: ApprovedCorrection[] = [];
    for (const file of correctionFiles) {
      const correction = JSON.parse(await fs.readFile(file, "utf8")) as ApprovedCorrection;
      if (correction.approved) {
        corrections.push(correction);
      }
    }
    return corrections;
  }
}

function inferMode(file: string): string {
  const name = path.basename(file).toLowerCase();
  if (name.includes("stax")) return "stax_fitness";
  if (name.includes("plan")) return "planning";
  if (name.includes("critic") || name.includes("audit")) return "audit";
  if (name.includes("intake")) return "intake";
  return "analysis";
}
