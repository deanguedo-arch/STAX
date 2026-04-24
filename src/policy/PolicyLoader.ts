import fs from "node:fs/promises";
import path from "node:path";

export type LoadedPolicy = {
  id: string;
  version: string;
  content: string;
};

export class PolicyLoader {
  constructor(private rootDir = process.cwd()) {}

  async load(policyId: string): Promise<LoadedPolicy> {
    const primary = path.join(this.rootDir, "policies", `${policyId}.md`);
    const fallback = path.join(process.cwd(), "policies", `${policyId}.md`);
    const filePath = await exists(primary) ? primary : fallback;
    const content = await fs.readFile(filePath, "utf8");
    const version = content.match(/Version:\s*([^\n]+)/)?.[1]?.trim() ?? "1.0.0";
    return { id: policyId, version, content };
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
