import fs from "node:fs/promises";
import path from "node:path";
import { ReviewStatsSchema, type ReviewRecord, type ReviewStats } from "./ReviewSchemas.js";
import { ReviewLedger } from "./ReviewLedger.js";

export class ReviewStatsStore {
  constructor(private rootDir = process.cwd()) {}

  async update(records?: ReviewRecord[]): Promise<ReviewStats> {
    const source = records ?? await new ReviewLedger(this.rootDir).list();
    const stats = ReviewStatsSchema.parse({
      updatedAt: new Date().toISOString(),
      total: source.length,
      byDisposition: this.countBy(source, "disposition"),
      byRisk: this.countBy(source, "riskLevel"),
      byState: this.countBy(source, "state")
    });
    const file = path.join(this.rootDir, "review", "stats", "latest.json");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(stats, null, 2), "utf8");
    return stats;
  }

  async read(): Promise<ReviewStats> {
    try {
      return ReviewStatsSchema.parse(JSON.parse(await fs.readFile(path.join(this.rootDir, "review", "stats", "latest.json"), "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return this.update();
      throw error;
    }
  }

  private countBy(records: ReviewRecord[], key: "disposition" | "riskLevel" | "state"): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const record of records) {
      counts[record[key]] = (counts[record[key]] ?? 0) + 1;
    }
    return counts;
  }
}
