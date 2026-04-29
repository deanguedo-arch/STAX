import fs from "node:fs/promises";
import path from "node:path";
import { createRunId } from "../utils/ids.js";
import type { MemoryRecord, MemoryType } from "./memoryTypes.js";

export type MemoryAddInput = {
  type: MemoryType;
  content: string;
  sourceRunId?: string;
  sourceEventId?: string;
  expiresAt?: string;
  neverExpireJustification?: string;
  confidence?: "low" | "medium" | "high";
  approved?: boolean;
  approvedBy?: string;
  approvalReason?: string;
  approvalSourceRunId?: string;
  allowPoisonRisk?: boolean;
  tags?: string[];
};

export type MemoryApprovalInput = {
  approvedBy: string;
  approvalReason: string;
  sourceRunId?: string;
  expiresAt?: string;
  neverExpireJustification?: string;
  allowPoisonRisk?: boolean;
};

export type MemoryRejectionInput = {
  rejectedBy?: string;
  rejectionReason?: string;
};

export class MemoryStore {
  constructor(private rootDir = process.cwd()) {}

  private file(type: MemoryType | "session" | "project"): string {
    return path.join(this.rootDir, "memory", String(type), "memory.json");
  }

  async add(
    scopeOrInput: "session" | "project" | MemoryAddInput,
    text?: string,
    tags: string[] = []
  ): Promise<MemoryRecord> {
    const input: MemoryAddInput =
      typeof scopeOrInput === "string"
        ? {
            type: scopeOrInput,
            content: text ?? "",
            tags,
            approved: false,
            confidence: "medium"
          }
        : scopeOrInput;
    const now = new Date().toISOString();
    const poisonScan = scanMemoryPoison(input.content, now);
    if (input.approved) {
      validateApprovalMetadata({
        approvedBy: input.approvedBy,
        approvalReason: input.approvalReason,
        expiresAt: input.expiresAt,
        neverExpireJustification: input.neverExpireJustification
      });
      if (poisonScan.status === "flagged" && !input.allowPoisonRisk) {
        throw new Error(`Memory poison scan flagged approval: ${poisonScan.flags.join(", ")}`);
      }
    }

    const record: MemoryRecord = {
      id: createRunId(),
      type: input.type,
      scope: input.type === "session" || input.type === "project" ? input.type : undefined,
      content: input.content,
      text: input.content,
      sourceRunId: input.sourceRunId,
      createdAt: now,
      expiresAt: input.expiresAt,
      confidence: input.confidence ?? "medium",
      approved: input.approved ?? false,
      approvedAt: input.approved ? now : undefined,
      approvedBy: input.approved ? input.approvedBy : undefined,
      approvalReason: input.approved ? input.approvalReason : undefined,
      approvalSourceRunId: input.approved ? (input.approvalSourceRunId ?? input.sourceRunId) : undefined,
      neverExpireJustification: input.approved ? input.neverExpireJustification : undefined,
      poisonScan,
      tags: input.tags ?? []
    };

    const records = await this.all(input.type);
    records.push(record);
    const file = this.file(input.type);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(records, null, 2), "utf8");
    return record;
  }

  async all(type: MemoryType | "session" | "project"): Promise<MemoryRecord[]> {
    try {
      const raw = await fs.readFile(this.file(type), "utf8");
      return (JSON.parse(raw) as MemoryRecord[]).map(normalizeMemoryRecord);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async search(query: string): Promise<MemoryRecord[]> {
    const lower = query.toLowerCase();
    const terms = lower
      .split(/[^a-z0-9_]+/i)
      .map((term) => term.trim())
      .filter((term) => term.length > 2);
    const types: MemoryType[] = PROJECT_MEMORY_TYPES;
    const now = Date.now();
    const groups = await Promise.all(types.map((type) => this.all(type)));
    return groups
      .flat()
      .filter((record) => record.approved)
      .filter((record) => !record.expiresAt || Date.parse(record.expiresAt) > now)
      .filter((record) => {
        if (!lower) return true;
        const haystack = [record.content, ...record.tags].join(" ").toLowerCase();
        return haystack.includes(lower) || terms.some((term) => haystack.includes(term));
      });
  }

  async approve(id: string, approval: MemoryApprovalInput): Promise<MemoryRecord> {
    return this.setApproval(id, true, approval);
  }

  async reject(id: string, rejection: MemoryRejectionInput = {}): Promise<MemoryRecord> {
    return this.setApproval(id, false, rejection);
  }

  private async setApproval(id: string, approved: boolean, decision: MemoryApprovalInput | MemoryRejectionInput): Promise<MemoryRecord> {
    const types: MemoryType[] = PROJECT_MEMORY_TYPES;
    for (const type of types) {
      const records = await this.all(type);
      const index = records.findIndex((record) => record.id === id);
      if (index === -1) continue;
      const now = new Date().toISOString();
      const current = records[index]!;
      const poisonScan = current.poisonScan ?? scanMemoryPoison(current.content, now);
      const updated = approved
        ? approveMemoryRecord(current, decision as MemoryApprovalInput, poisonScan, now)
        : {
            ...current,
            approved: false,
            rejectedAt: now,
            rejectedBy: (decision as MemoryRejectionInput).rejectedBy ?? "cli",
            rejectionReason: (decision as MemoryRejectionInput).rejectionReason ?? "Rejected by reviewer.",
            poisonScan
          };
      records[index] = updated;
      const file = this.file(type);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(records, null, 2), "utf8");
      return updated;
    }
    throw new Error(`Memory not found: ${id}`);
  }
}

export const PROJECT_MEMORY_TYPES: MemoryType[] = [
  "session",
  "project",
  "user_preference",
  "correction",
  "golden",
  "example",
  "forbidden",
  "decision",
  "known_failure",
  "proven_working",
  "unproven_claim",
  "next_action",
  "risk"
];

function approveMemoryRecord(
  record: MemoryRecord,
  approval: MemoryApprovalInput,
  poisonScan: MemoryRecord["poisonScan"],
  approvedAt: string
): MemoryRecord {
  validateApprovalMetadata(approval);
  if (poisonScan.status === "flagged" && !approval.allowPoisonRisk) {
    throw new Error(`Memory poison scan flagged approval: ${poisonScan.flags.join(", ")}`);
  }
  return {
    ...record,
    approved: true,
    approvedAt,
    approvedBy: approval.approvedBy,
    approvalReason: approval.approvalReason,
    approvalSourceRunId: approval.sourceRunId ?? record.sourceRunId,
    expiresAt: approval.expiresAt ?? record.expiresAt,
    neverExpireJustification: approval.neverExpireJustification,
    poisonScan
  };
}

function validateApprovalMetadata(input: {
  approvedBy?: string;
  approvalReason?: string;
  expiresAt?: string;
  neverExpireJustification?: string;
}) {
  if (!input.approvedBy?.trim()) {
    throw new Error("Memory approval requires approvedBy.");
  }
  if (!input.approvalReason?.trim()) {
    throw new Error("Memory approval requires approvalReason.");
  }
  if (!input.expiresAt && !input.neverExpireJustification?.trim()) {
    throw new Error("Memory approval requires expiresAt or neverExpireJustification.");
  }
}

function scanMemoryPoison(content: string, scannedAt: string): MemoryRecord["poisonScan"] {
  const checks: Array<[RegExp, string]> = [
    [/\b(ignore|override)\s+(previous|system|developer)\s+instructions?\b/i, "instruction_override"],
    [/\bauto[- ]?approve\b|\bself[- ]?approve\b/i, "self_approval"],
    [/\bpoison memory\b|\bmemory poisoning\b/i, "memory_poisoning"],
    [/\bdisable\s+(critic|schema|policy|evidence)\b/i, "governance_disable"],
    [/\bpromote\s+without\s+approval\b/i, "promotion_bypass"]
  ];
  const flags = checks.filter(([pattern]) => pattern.test(content)).map(([, flag]) => flag);
  return {
    status: flags.length ? "flagged" : "passed",
    flags,
    scannedAt
  };
}

function normalizeMemoryRecord(record: MemoryRecord): MemoryRecord {
  return {
    ...record,
    poisonScan: record.poisonScan ?? scanMemoryPoison(record.content, record.createdAt)
  };
}
