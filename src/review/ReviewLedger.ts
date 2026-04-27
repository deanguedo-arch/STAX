import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  REVIEW_ROUTER_VERSION,
  ReviewRecordSchema,
  ReviewStateSchema,
  type ReviewRecord,
  type ReviewSource,
  type ReviewState,
  type ReviewTriageResult
} from "./ReviewSchemas.js";

export class ReviewLedger {
  constructor(private rootDir = process.cwd()) {}

  async record(source: ReviewSource, triage: ReviewTriageResult): Promise<{ record: ReviewRecord; created: boolean }> {
    await this.ensureDirs();
    const sourceHash = this.sourceHash(source);
    const existing = (await this.list()).find((record) =>
      record.sourceId === source.sourceId &&
      record.sourceHash === sourceHash &&
      record.routerVersion === REVIEW_ROUTER_VERSION
    );
    if (existing) return { record: existing, created: false };

    const supersedesReviewIds = (await this.list())
      .filter((record) => record.sourceId === source.sourceId && record.routerVersion === REVIEW_ROUTER_VERSION)
      .map((record) => record.reviewId);
    const now = new Date().toISOString();
    const record = ReviewRecordSchema.parse({
      reviewId: `rev-${sourceHash.slice(0, 16)}`,
      sourceId: source.sourceId,
      sourceHash,
      sourceType: source.sourceType,
      sourcePath: source.sourcePath,
      workspace: source.workspace,
      riskScore: triage.riskScore,
      riskLevel: triage.riskLevel,
      confidence: triage.confidence,
      disposition: triage.disposition,
      reasonCodes: triage.reasonCodes,
      evidencePaths: triage.evidencePaths,
      routerVersion: REVIEW_ROUTER_VERSION,
      state: "active",
      requiresPromotionGate: true,
      allowedActions: triage.allowedActions,
      supersedesReviewIds,
      createdAt: now,
      updatedAt: now
    });
    await fs.writeFile(this.recordPath(record.reviewId), JSON.stringify(record, null, 2), "utf8");
    return { record, created: true };
  }

  async get(reviewId: string): Promise<ReviewRecord | undefined> {
    for (const record of await this.list()) {
      if (record.reviewId === reviewId || record.reviewId.includes(reviewId)) return record;
    }
    return undefined;
  }

  async list(): Promise<ReviewRecord[]> {
    await this.ensureDirs();
    const records: ReviewRecord[] = [];
    for (const entry of await fs.readdir(this.ledgerDir())) {
      if (!entry.endsWith(".json")) continue;
      records.push(ReviewRecordSchema.parse(JSON.parse(await fs.readFile(path.join(this.ledgerDir(), entry), "utf8"))));
    }
    return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async bySource(sourceId: string): Promise<ReviewRecord[]> {
    return (await this.list()).filter((record) => record.sourceId === sourceId || record.sourceId.includes(sourceId));
  }

  async transition(reviewId: string, state: ReviewState, reason: string): Promise<ReviewRecord> {
    if (!reason.trim()) throw new Error("Review metadata changes require --reason.");
    ReviewStateSchema.parse(state);
    const record = await this.get(reviewId);
    if (!record) throw new Error(`Review item not found: ${reviewId}`);
    const updated = ReviewRecordSchema.parse({
      ...record,
      state,
      stateReason: reason,
      updatedAt: new Date().toISOString()
    });
    await fs.writeFile(this.recordPath(updated.reviewId), JSON.stringify(updated, null, 2), "utf8");
    return updated;
  }

  sourceHash(source: ReviewSource): string {
    return crypto
      .createHash("sha256")
      .update(JSON.stringify({
        sourceId: source.sourceId,
        sourceType: source.sourceType,
        sourcePath: source.sourcePath,
        content: source.content,
        workspace: source.workspace,
        synthetic: source.synthetic,
        approvalState: source.approvalState,
        mode: source.mode,
        targetArtifactType: source.targetArtifactType,
        targetPaths: source.targetPaths,
        failureTypes: source.failureTypes,
        riskTags: source.riskTags,
        evidencePaths: source.evidencePaths,
        reason: source.reason
      }))
      .digest("hex");
  }

  private ledgerDir(): string {
    return path.join(this.rootDir, "review", "ledger");
  }

  private recordPath(reviewId: string): string {
    return path.join(this.ledgerDir(), `${reviewId}.json`);
  }

  private async ensureDirs(): Promise<void> {
    await fs.mkdir(this.ledgerDir(), { recursive: true });
  }
}
