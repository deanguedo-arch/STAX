import fs from "node:fs/promises";
import path from "node:path";

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
      lines.push(
        JSON.stringify({
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
        })
      );
    }

    await fs.writeFile(outputPath, lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
    return { path: outputPath, count: lines.length };
  }

  async exportPreference(): Promise<ExportResult> {
    const outputDir = path.join(this.rootDir, "training", "exports");
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, "preference.jsonl");
    const correctionDir = path.join(this.rootDir, "corrections", "approved");
    const lines: string[] = [];

    try {
      const entries = await fs.readdir(correctionDir);
      for (const entry of entries.filter((item) => item.endsWith(".json"))) {
        const correction = JSON.parse(
          await fs.readFile(path.join(correctionDir, entry), "utf8")
        ) as {
          reason: string;
          correctedOutput: string;
          originalOutput: string;
          errorType: string;
        };
        lines.push(
          JSON.stringify({
            prompt: correction.reason,
            chosen: correction.correctedOutput,
            rejected: correction.originalOutput,
            reason: "chosen follows correction policy",
            metadata: {
              mode: "analysis",
              errorType: correction.errorType
            }
          })
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    await fs.writeFile(outputPath, lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
    return { path: outputPath, count: lines.length };
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
