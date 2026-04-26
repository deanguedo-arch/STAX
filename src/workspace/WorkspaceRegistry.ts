import fs from "node:fs/promises";
import path from "node:path";

export type WorkspaceRecord = {
  name: string;
  repo: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceRegistryFile = {
  current?: string;
  workspaces: WorkspaceRecord[];
};

export class WorkspaceRegistry {
  constructor(private rootDir = process.cwd()) {}

  async list(): Promise<WorkspaceRegistryFile> {
    return this.read();
  }

  async create(input: { name: string; repo: string }): Promise<WorkspaceRecord> {
    if (!input.name.trim()) throw new Error("Workspace name is required.");
    if (!input.repo.trim()) throw new Error("Workspace repo path is required.");
    const stat = await fs.stat(path.resolve(this.rootDir, input.repo));
    if (!stat.isDirectory()) throw new Error(`Workspace repo is not a directory: ${input.repo}`);
    const file = await this.read();
    const now = new Date().toISOString();
    const record: WorkspaceRecord = {
      name: input.name,
      repo: input.repo,
      createdAt: file.workspaces.find((item) => item.name === input.name)?.createdAt ?? now,
      updatedAt: now
    };
    file.workspaces = [...file.workspaces.filter((item) => item.name !== input.name), record].sort((a, b) => a.name.localeCompare(b.name));
    file.current = file.current ?? input.name;
    await this.write(file);
    return record;
  }

  async use(name: string): Promise<WorkspaceRecord> {
    const file = await this.read();
    const record = file.workspaces.find((item) => item.name === name);
    if (!record) throw new Error(`Workspace not found: ${name}`);
    file.current = name;
    await this.write(file);
    return record;
  }

  async current(): Promise<WorkspaceRecord | undefined> {
    const file = await this.read();
    return file.workspaces.find((item) => item.name === file.current);
  }

  private async read(): Promise<WorkspaceRegistryFile> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath(), "utf8")) as WorkspaceRegistryFile;
      return { current: parsed.current, workspaces: parsed.workspaces ?? [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { workspaces: [] };
      throw error;
    }
  }

  private async write(file: WorkspaceRegistryFile): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath()), { recursive: true });
    await fs.writeFile(this.filePath(), JSON.stringify(file, null, 2), "utf8");
  }

  private filePath(): string {
    return path.join(this.rootDir, "workspaces", "registry.json");
  }
}
