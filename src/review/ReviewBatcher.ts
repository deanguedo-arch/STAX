import fs from "node:fs/promises";
import path from "node:path";
import { ReviewBatchSchema, type ReviewBatch, type ReviewRecord } from "./ReviewSchemas.js";
import { ReviewQueue } from "./ReviewQueue.js";

export class ReviewBatcher {
  constructor(private rootDir = process.cwd()) {}

  async create(input: { workspace?: string } = {}): Promise<{ path: string; batch: ReviewBatch; markdown: string }> {
    const records = await new ReviewQueue(this.rootDir).list({ workspace: input.workspace });
    const reviewIds = records.map((record) => record.reviewId);
    const batch = ReviewBatchSchema.parse({
      batchId: `review-batch-${new Date().toISOString().replace(/[:.]/g, "-")}`,
      createdAt: new Date().toISOString(),
      workspace: input.workspace,
      reviewIds,
      counts: this.counts(records)
    });
    const dir = path.join(this.rootDir, "review", "batches");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${batch.batchId}.json`);
    await fs.writeFile(file, JSON.stringify(batch, null, 2), "utf8");
    const markdown = this.format(batch, records);
    await fs.writeFile(path.join(dir, `${batch.batchId}.md`), markdown, "utf8");
    return { path: path.relative(this.rootDir, file), batch, markdown };
  }

  format(batch: ReviewBatch, records: ReviewRecord[]): string {
    const blocked = records.filter((record) => record.disposition === "hard_block");
    const human = records.filter((record) => record.disposition === "human_review");
    const batchReview = records.filter((record) => record.disposition === "batch_review");
    return [
      "# STAX Review Digest",
      "",
      `Batch: ${batch.batchId}`,
      batch.workspace ? `Workspace: ${batch.workspace}` : "Workspace: all",
      "",
      "## Blocked",
      ...(blocked.length ? blocked.map((record) => `- ${record.reviewId}: ${record.reasonCodes.join(", ")}`) : ["- None"]),
      "",
      "## Needs Judgment",
      ...(human.length ? human.map((record) => `- ${record.reviewId}: ${record.sourceType}:${record.sourceId}`) : ["- None"]),
      "",
      "## Batch Review",
      ...(batchReview.length ? batchReview.map((record) => `- ${record.reviewId}: ${record.reasonCodes.join(", ")}`) : ["- None"]),
      "",
      "## Summary",
      ...Object.entries(batch.counts).map(([key, count]) => `- ${key}: ${count}`)
    ].join("\n");
  }

  private counts(records: ReviewRecord[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const record of records) {
      counts[record.disposition] = (counts[record.disposition] ?? 0) + 1;
    }
    return counts;
  }
}
