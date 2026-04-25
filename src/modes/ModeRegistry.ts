import fs from "node:fs/promises";
import path from "node:path";
import type { RaxMode } from "../schemas/Config.js";

export type ModeMaturity = "draft" | "usable" | "hardened" | "behavior_proven";

export type ModeRegistryEntry = {
  mode: RaxMode;
  schema: string;
  validator: string;
  evalFolders: string[];
  goldens: string[];
  policies: string[];
  maturity: ModeMaturity;
};

export type ModeMaturityReport = ModeRegistryEntry & {
  proofGaps: string[];
};

const BEHAVIOR_PROVEN_REQUIREMENTS = [
  "schema",
  "validator",
  "negative evals",
  "replay proof",
  "correction path",
  "goldens"
];

export class ModeRegistry {
  constructor(private rootDir = process.cwd()) {}

  async list(): Promise<ModeRegistryEntry[]> {
    const registry = await this.readRegistry();
    return registry.modes;
  }

  async inspect(mode: string): Promise<ModeRegistryEntry | undefined> {
    const modes = await this.list();
    return modes.find((entry) => entry.mode === mode);
  }

  async maturity(): Promise<ModeMaturityReport[]> {
    const modes = await this.list();
    return modes.map((entry) => ({
      ...entry,
      proofGaps: this.proofGaps(entry)
    }));
  }

  private proofGaps(entry: ModeRegistryEntry): string[] {
    if (entry.maturity !== "behavior_proven") {
      return entry.maturity === "draft"
        ? ["mode is draft"]
        : BEHAVIOR_PROVEN_REQUIREMENTS.filter((requirement) => {
            if (requirement === "schema") return !entry.schema || entry.schema === "draft";
            if (requirement === "validator") return !entry.validator || entry.validator === "draft";
            if (requirement === "goldens") return entry.goldens.length === 0;
            if (requirement === "negative evals") {
              return !entry.evalFolders.some((folder) => folder.includes("regression"));
            }
            if (requirement === "replay proof") return entry.mode !== "stax_fitness";
            if (requirement === "correction path") return entry.mode !== "stax_fitness";
            return false;
          });
    }
    return [];
  }

  private async readRegistry(): Promise<{ modes: ModeRegistryEntry[] }> {
    const file = path.join(this.rootDir, "modes", "registry.json");
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as { modes: ModeRegistryEntry[] };
  }
}
