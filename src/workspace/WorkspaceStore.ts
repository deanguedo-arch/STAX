import fs from "node:fs/promises";
import path from "node:path";
import {
  WORKSPACE_DIRS,
  WORKSPACE_DOC_FILES,
  WorkspaceNameSchema,
  WorkspaceRegistryFileSchema,
  WorkspaceSchema,
  type WorkspaceRecordV2,
  type WorkspaceRegistryFileV2,
  type WorkspaceRegistryRecordV2
} from "./WorkspaceSchema.js";

export type WorkspaceCreateInput = {
  workspace: string;
  repoPath?: string;
  use?: boolean;
  tags?: string[];
};

export type WorkspaceStatus = {
  current?: string;
  workspace?: WorkspaceRecordV2;
  repoPath?: string;
  linkedRepoPath?: string;
};

export class WorkspaceStore {
  constructor(private rootDir = process.cwd()) {}

  async create(input: WorkspaceCreateInput): Promise<WorkspaceRecordV2> {
    const workspace = WorkspaceNameSchema.parse(input.workspace);
    const repoPath = input.repoPath?.trim() || undefined;
    const repoPathResolved = repoPath ? await this.resolveRepoPath(repoPath) : undefined;
    const existing = await this.readWorkspaceJson(workspace).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    const now = new Date().toISOString();
    const record = WorkspaceSchema.parse({
      workspace,
      repoPath,
      repoPathOriginal: repoPath,
      repoPathResolved,
      defaultMode: "project_brain",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      approved: true,
      tags: input.tags ?? existing?.tags ?? []
    });

    await this.ensureWorkspaceScaffold(record);
    await this.writeWorkspaceJson(record);

    const registry = await this.readRegistry();
    const shouldUse = input.use === true || !registry.current;
    const registryRecord: WorkspaceRegistryRecordV2 = {
      name: workspace,
      repo: repoPath,
      repoPath,
      createdAt: existing?.createdAt ?? registry.workspaces.find((item) => item.name === workspace)?.createdAt ?? now,
      updatedAt: now
    };
    registry.workspaces = [
      ...registry.workspaces.filter((item) => item.name !== workspace),
      registryRecord
    ].sort((a, b) => a.name.localeCompare(b.name));
    if (shouldUse) registry.current = workspace;
    await this.writeRegistry(registry);
    return record;
  }

  async use(workspace: string): Promise<WorkspaceRecordV2> {
    const name = WorkspaceNameSchema.parse(workspace);
    const record = await this.get(name);
    if (!record) throw new Error(`Workspace not found: ${name}`);
    const registry = await this.readRegistry();
    registry.current = name;
    await this.writeRegistry(registry);
    return record;
  }

  async current(): Promise<WorkspaceRecordV2 | undefined> {
    const registry = await this.readRegistry();
    return registry.current ? this.get(registry.current) : undefined;
  }

  async status(): Promise<WorkspaceStatus> {
    const registry = await this.readRegistry();
    const workspace = registry.current ? await this.get(registry.current) : undefined;
    return {
      current: registry.current,
      workspace,
      repoPath: workspace?.repoPath,
      linkedRepoPath: workspace?.repoPathResolved
    };
  }

  async list(): Promise<WorkspaceRegistryFileV2> {
    return this.readRegistry();
  }

  async get(workspace: string): Promise<WorkspaceRecordV2 | undefined> {
    const name = WorkspaceNameSchema.parse(workspace);
    try {
      return await this.readWorkspaceJson(name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return this.migrateRegistryRecord(name);
    }
  }

  async readWorkspaceDocs(workspace: string): Promise<Array<{ path: string; exists: boolean; excerpt?: string }>> {
    const name = WorkspaceNameSchema.parse(workspace);
    return Promise.all(
      WORKSPACE_DOC_FILES.map(async (file) => {
        const relativePath = path.join("workspaces", name, file);
        try {
          const raw = await fs.readFile(path.join(this.rootDir, relativePath), "utf8");
          return { path: relativePath, exists: true, excerpt: raw.trim().slice(0, 1400) };
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          return { path: relativePath, exists: false };
        }
      })
    );
  }

  workspaceDir(workspace: string): string {
    return path.join(this.rootDir, "workspaces", WorkspaceNameSchema.parse(workspace));
  }

  private async migrateRegistryRecord(workspace: string): Promise<WorkspaceRecordV2 | undefined> {
    const registry = await this.readRegistry();
    const legacy = registry.workspaces.find((item) => item.name === workspace);
    if (!legacy) return undefined;
    const repoPath = legacy.repoPath ?? legacy.repo;
    const record = WorkspaceSchema.parse({
      workspace,
      repoPath,
      repoPathOriginal: repoPath,
      repoPathResolved: repoPath ? await this.resolveRepoPath(repoPath) : undefined,
      defaultMode: "project_brain",
      createdAt: legacy.createdAt,
      updatedAt: new Date().toISOString(),
      approved: true,
      tags: []
    });
    await this.ensureWorkspaceScaffold(record);
    await this.writeWorkspaceJson(record);
    return record;
  }

  private async resolveRepoPath(repoPath: string): Promise<string> {
    const resolved = path.resolve(this.rootDir, repoPath);
    const stat = await fs.stat(resolved).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        throw new Error(`Workspace repo path does not exist: ${repoPath}`);
      }
      throw error;
    });
    if (!stat.isDirectory()) throw new Error(`Workspace repo path is not a directory: ${repoPath}`);
    return resolved;
  }

  private async ensureWorkspaceScaffold(record: WorkspaceRecordV2): Promise<void> {
    const dir = this.workspaceDir(record.workspace);
    await fs.mkdir(dir, { recursive: true });
    await Promise.all(WORKSPACE_DIRS.map((entry) => fs.mkdir(path.join(dir, entry), { recursive: true })));
    for (const file of WORKSPACE_DOC_FILES) {
      const target = path.join(dir, file);
      try {
        await fs.stat(target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        await fs.writeFile(target, this.initialDoc(record.workspace, file), "utf8");
      }
    }
  }

  private initialDoc(workspace: string, file: string): string {
    const title = file.replace(/_/g, " ").replace(/\.md$/i, "").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    return [`# ${title}`, "", `Workspace: ${workspace}`, "", "- No approved entries yet.", ""].join("\n");
  }

  private async readWorkspaceJson(workspace: string): Promise<WorkspaceRecordV2> {
    return WorkspaceSchema.parse(JSON.parse(await fs.readFile(path.join(this.workspaceDir(workspace), "workspace.json"), "utf8")));
  }

  private async writeWorkspaceJson(record: WorkspaceRecordV2): Promise<void> {
    await fs.writeFile(
      path.join(this.workspaceDir(record.workspace), "workspace.json"),
      JSON.stringify(record, null, 2),
      "utf8"
    );
  }

  private async readRegistry(): Promise<WorkspaceRegistryFileV2> {
    try {
      const raw = JSON.parse(await fs.readFile(this.registryPath(), "utf8")) as unknown;
      return WorkspaceRegistryFileSchema.parse({
        current: (raw as { current?: string }).current,
        workspaces: (raw as { workspaces?: unknown[] }).workspaces ?? []
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { workspaces: [] };
      throw error;
    }
  }

  private async writeRegistry(registry: WorkspaceRegistryFileV2): Promise<void> {
    await fs.mkdir(path.dirname(this.registryPath()), { recursive: true });
    await fs.writeFile(this.registryPath(), JSON.stringify(registry, null, 2), "utf8");
  }

  private registryPath(): string {
    return path.join(this.rootDir, "workspaces", "registry.json");
  }
}
