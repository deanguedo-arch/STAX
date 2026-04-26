import { WorkspaceStore } from "./WorkspaceStore.js";

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
    const registry = await new WorkspaceStore(this.rootDir).list();
    return {
      current: registry.current,
      workspaces: registry.workspaces.map((item) => ({
        name: item.name,
        repo: item.repoPath ?? item.repo ?? "",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    };
  }

  async create(input: { name: string; repo: string }): Promise<WorkspaceRecord> {
    const record = await new WorkspaceStore(this.rootDir).create({
      workspace: input.name,
      repoPath: input.repo
    });
    return this.toLegacy(record);
  }

  async use(name: string): Promise<WorkspaceRecord> {
    return this.toLegacy(await new WorkspaceStore(this.rootDir).use(name));
  }

  async current(): Promise<WorkspaceRecord | undefined> {
    const record = await new WorkspaceStore(this.rootDir).current();
    return record ? this.toLegacy(record) : undefined;
  }

  private toLegacy(record: { workspace: string; repoPath?: string; createdAt: string; updatedAt: string }): WorkspaceRecord {
    return {
      name: record.workspace,
      repo: record.repoPath ?? "",
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }
}
