import fs from "node:fs/promises";
import path from "node:path";

export type ClaimState = "claimed" | "tested" | "proven" | "disproven" | "stale";

export type ClaimLedgerItem = {
  id: string;
  claim: string;
  state: ClaimState;
  evidenceIds: string[];
  source: string;
  updatedAt: string;
};

export class ClaimLedger {
  constructor(private rootDir = process.cwd()) {}

  async list(): Promise<ClaimLedgerItem[]> {
    const raw = await this.readLedger();
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("| claim_"))
      .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
      .filter((cells) => cells.length >= 6)
      .map(([id, claim, state, evidenceIds, source, updatedAt]) => ({
        id,
        claim,
        state: state as ClaimState,
        evidenceIds: evidenceIds === "-" ? [] : evidenceIds.split(",").map((item) => item.trim()),
        source,
        updatedAt
      }));
  }

  async unproven(): Promise<ClaimLedgerItem[]> {
    const items = await this.list();
    return items.filter((item) => item.state === "claimed" || item.state === "stale");
  }

  proposeClaim(input: { claim: string; source: string; evidenceIds?: string[] }): ClaimLedgerItem {
    const normalized = input.claim.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return {
      id: `claim_${normalized.slice(0, 48) || "unproven"}`,
      claim: input.claim,
      state: input.evidenceIds?.length ? "tested" : "claimed",
      evidenceIds: input.evidenceIds ?? [],
      source: input.source,
      updatedAt: new Date().toISOString().slice(0, 10)
    };
  }

  private async readLedger(): Promise<string> {
    const file = path.join(this.rootDir, "docs", "CLAIM_LEDGER.md");
    try {
      return await fs.readFile(file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return "";
      }
      throw error;
    }
  }
}
