import path from "node:path";
import { WorkspaceStore } from "./WorkspaceStore.js";
import type { WorkspaceRecordV2 } from "./WorkspaceSchema.js";

export type WorkspaceContextInput = {
  workspace?: string;
  threadWorkspace?: string;
  requireWorkspace?: boolean;
};

export type ResolvedWorkspaceContext = {
  workspace?: string;
  record?: WorkspaceRecordV2;
  repoPath?: string;
  linkedRepoPath?: string;
  workspaceDir?: string;
  source: "explicit" | "thread" | "current" | "none";
};

export class WorkspaceContext {
  constructor(private rootDir = process.cwd(), private store = new WorkspaceStore(rootDir)) {}

  async resolve(input: WorkspaceContextInput = {}): Promise<ResolvedWorkspaceContext> {
    const explicit = input.workspace?.trim();
    if (explicit && explicit !== "current") {
      return this.resolveNamed(explicit, "explicit", true);
    }
    if (explicit === "current") {
      const current = await this.store.current();
      if (current) return this.fromRecord(current, "current");
      if (input.requireWorkspace) throw new Error("No active workspace is set.");
      return { source: "none" };
    }

    const threadWorkspace = input.threadWorkspace?.trim();
    if (threadWorkspace && threadWorkspace !== "default") {
      return this.resolveNamed(threadWorkspace, "thread", false);
    }

    const current = await this.store.current();
    if (current) return this.fromRecord(current, "current");
    if (input.requireWorkspace) throw new Error("No active workspace is set.");
    return { source: "none" };
  }

  private async resolveNamed(
    workspace: string,
    source: "explicit" | "thread",
    strict: boolean
  ): Promise<ResolvedWorkspaceContext> {
    const record = await this.store.get(workspace);
    if (!record) {
      if (strict) throw new Error(`Workspace not found: ${workspace}`);
      return { workspace, source: "none" };
    }
    return this.fromRecord(record, source);
  }

  private fromRecord(record: WorkspaceRecordV2, source: ResolvedWorkspaceContext["source"]): ResolvedWorkspaceContext {
    return {
      workspace: record.workspace,
      record,
      repoPath: record.repoPath,
      linkedRepoPath: record.repoPathResolved
        ? path.resolve(record.repoPathResolved)
        : undefined,
      workspaceDir: this.store.workspaceDir(record.workspace),
      source
    };
  }
}
