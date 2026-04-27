import fs from "node:fs/promises";
import path from "node:path";
import type { ReviewDisposition, ReviewRecord, ReviewRiskLevel } from "./ReviewSchemas.js";
import { ReviewRecordSchema } from "./ReviewSchemas.js";

export type ReviewInboxFilter = {
  workspace?: string;
  disposition?: ReviewDisposition;
  risk?: ReviewRiskLevel;
  includeAuto?: boolean;
};

const visibleByDefault = new Set<ReviewDisposition>(["batch_review", "human_review", "hard_block"]);

export class ReviewQueue {
  constructor(private rootDir = process.cwd()) {}

  async write(record: ReviewRecord): Promise<string> {
    await this.ensureDirs();
    const parsed = ReviewRecordSchema.parse(record);
    const file = path.join(this.queueDir(parsed.disposition), `${parsed.reviewId}.json`);
    await fs.writeFile(file, JSON.stringify(parsed, null, 2), "utf8");
    if (parsed.disposition === "auto_stage_for_review") {
      const stagedFile = path.join(this.rootDir, "review", "staged", `${parsed.reviewId}.json`);
      await fs.mkdir(path.dirname(stagedFile), { recursive: true });
      await fs.writeFile(stagedFile, JSON.stringify(parsed, null, 2), "utf8");
    }
    return path.relative(this.rootDir, file);
  }

  async list(filter: ReviewInboxFilter = {}): Promise<ReviewRecord[]> {
    await this.ensureDirs();
    const dispositions = filter.disposition
      ? [filter.disposition]
      : filter.includeAuto
        ? ["auto_archive", "auto_candidate", "auto_stage_for_review", "batch_review", "human_review", "hard_block"] as ReviewDisposition[]
        : Array.from(visibleByDefault);
    const records: ReviewRecord[] = [];
    for (const disposition of dispositions) {
      for (const entry of await this.safeReaddir(this.queueDir(disposition))) {
        if (!entry.endsWith(".json")) continue;
        const record = ReviewRecordSchema.parse(JSON.parse(await fs.readFile(path.join(this.queueDir(disposition), entry), "utf8")));
        if (record.state !== "active" && !filter.includeAuto) continue;
        if (filter.workspace && record.workspace !== filter.workspace) continue;
        if (filter.risk && record.riskLevel !== filter.risk) continue;
        records.push(record);
      }
    }
    return records.sort((a, b) => b.riskScore - a.riskScore || a.createdAt.localeCompare(b.createdAt));
  }

  formatInbox(records: ReviewRecord[], title = "Review Inbox"): string {
    if (records.length === 0) return `${title}\n- No matching review items.`;
    return [
      title,
      ...records.map((record) => [
        `- ${record.reviewId}`,
        `  Disposition: ${record.disposition}`,
        `  Risk: ${record.riskLevel} (${record.riskScore})`,
        `  Source: ${record.sourceType}:${record.sourceId}`,
        record.workspace ? `  Workspace: ${record.workspace}` : undefined,
        `  ReasonCodes: ${record.reasonCodes.join(", ") || "none"}`,
        `  Next: ${record.allowedActions[0] ?? "Inspect source artifact."}`
      ].filter(Boolean).join("\n"))
    ].join("\n");
  }

  queueDir(disposition: ReviewDisposition): string {
    return path.join(this.rootDir, "review", "queue", disposition);
  }

  async ensureDirs(): Promise<void> {
    await Promise.all(
      ["auto_archive", "auto_candidate", "auto_stage_for_review", "batch_review", "human_review", "hard_block"]
        .map((disposition) => fs.mkdir(this.queueDir(disposition as ReviewDisposition), { recursive: true }))
    );
  }

  private async safeReaddir(dir: string): Promise<string[]> {
    try {
      return await fs.readdir(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}
