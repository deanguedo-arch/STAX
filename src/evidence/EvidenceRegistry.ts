import fs from "node:fs/promises";
import path from "node:path";

export type EvidenceType = "test" | "eval" | "trace" | "run" | "doc" | "command";
export type EvidenceConfidence = "low" | "medium" | "high";

export type EvidenceItem = {
  id: string;
  claim: string;
  evidenceType: EvidenceType;
  path: string;
  command?: string;
  confidence: EvidenceConfidence;
  createdAt: string;
};

export class EvidenceRegistry {
  constructor(private rootDir = process.cwd()) {}

  async list(): Promise<EvidenceItem[]> {
    const raw = await this.readRegistry();
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("| ev_"))
      .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
      .filter((cells) => cells.length >= 7)
      .map(([id, claim, evidenceType, evidencePath, command, confidence, createdAt]) => ({
        id,
        claim,
        evidenceType: evidenceType as EvidenceType,
        path: evidencePath,
        command: command === "-" ? undefined : command,
        confidence: confidence as EvidenceConfidence,
        createdAt
      }));
  }

  async find(id: string): Promise<EvidenceItem | undefined> {
    const items = await this.list();
    return items.find((item) => item.id === id);
  }

  async has(id: string): Promise<boolean> {
    return Boolean(await this.find(id));
  }

  private async readRegistry(): Promise<string> {
    const file = path.join(this.rootDir, "docs", "EVIDENCE_REGISTRY.md");
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
