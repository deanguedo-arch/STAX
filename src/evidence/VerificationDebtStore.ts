import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { CommandEvidence } from "./CommandEvidenceStore.js";

export const VerificationDebtSchema = z.object({
  debtId: z.string().min(1),
  workspace: z.string().optional(),
  linkedRepoPath: z.string().optional(),
  requiredCommand: z.string().min(1),
  reason: z.string().min(1),
  status: z.enum(["open", "satisfied", "stale"]),
  satisfiedByEvidenceId: z.string().optional(),
  sourceRunId: z.string().optional(),
  sourceReceiptId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type VerificationDebt = z.infer<typeof VerificationDebtSchema>;

export type VerificationDebtInput = {
  workspace?: string;
  linkedRepoPath?: string;
  requiredCommand: string;
  reason: string;
  sourceRunId?: string;
  sourceReceiptId?: string;
};

export class VerificationDebtStore {
  constructor(private rootDir = process.cwd()) {}

  async recordOpen(input: VerificationDebtInput): Promise<VerificationDebt> {
    const existing = (await this.list({ workspace: input.workspace }))
      .find((item) => item.requiredCommand === input.requiredCommand && item.status === "open");
    if (existing) return existing;
    const now = new Date().toISOString();
    const debtId = `debt-${this.hash(`${input.workspace ?? ""}:${input.linkedRepoPath ?? ""}:${input.requiredCommand}`).slice(0, 16)}`;
    const debt = VerificationDebtSchema.parse({
      debtId,
      workspace: input.workspace,
      linkedRepoPath: input.linkedRepoPath,
      requiredCommand: input.requiredCommand,
      reason: input.reason,
      status: "open",
      sourceRunId: input.sourceRunId,
      sourceReceiptId: input.sourceReceiptId,
      createdAt: now,
      updatedAt: now
    });
    await this.write(debt);
    return debt;
  }

  async satisfyMatching(evidence: CommandEvidence): Promise<VerificationDebt[]> {
    if (!evidence.success) return [];
    const debts = await this.list({ workspace: evidence.workspace });
    const matched = debts.filter((debt) =>
      debt.status === "open" &&
      commandsMatch(debt.requiredCommand, evidence.command)
    );
    const updated: VerificationDebt[] = [];
    for (const debt of matched) {
      const satisfied = VerificationDebtSchema.parse({
        ...debt,
        status: "satisfied",
        satisfiedByEvidenceId: evidence.commandEvidenceId,
        updatedAt: new Date().toISOString()
      });
      await this.write(satisfied);
      updated.push(satisfied);
    }
    return updated;
  }

  async list(filter: { workspace?: string; status?: VerificationDebt["status"] } = {}): Promise<VerificationDebt[]> {
    const root = path.join(this.rootDir, "evidence", "verification_debt");
    const debts: VerificationDebt[] = [];
    try {
      const files = (await fs.readdir(root)).filter((file) => file.endsWith(".json")).sort();
      for (const file of files) {
        const debt = VerificationDebtSchema.parse(JSON.parse(await fs.readFile(path.join(root, file), "utf8")));
        if (filter.workspace && debt.workspace !== filter.workspace) continue;
        if (filter.status && debt.status !== filter.status) continue;
        debts.push(debt);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    return debts;
  }

  private async write(debt: VerificationDebt): Promise<void> {
    const dir = path.join(this.rootDir, "evidence", "verification_debt");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${debt.debtId}.json`), JSON.stringify(debt, null, 2), "utf8");
  }

  private hash(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
}

export function commandsMatch(required: string, actual: string): boolean {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  return normalize(required) === normalize(actual);
}
