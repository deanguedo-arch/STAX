import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WorkspaceContext } from "../src/workspace/WorkspaceContext.js";
import { WorkspaceStore } from "../src/workspace/WorkspaceStore.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-workspace-"));
}

describe("WorkspaceStore", () => {
  it("creates and uses workspaces with linked repo paths", async () => {
    const rootDir = await tempRoot();
    await fs.mkdir(path.join(rootDir, "linked"), { recursive: true });
    const store = new WorkspaceStore(rootDir);

    const created = await store.create({ workspace: "demo", repoPath: "linked" });
    const status = await store.status();

    expect(created.workspace).toBe("demo");
    expect(created.repoPath).toBe("linked");
    expect(status.current).toBe("demo");
    expect(status.linkedRepoPath).toBe(path.join(rootDir, "linked"));
    await expect(fs.stat(path.join(rootDir, "workspaces", "demo", "workspace.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(rootDir, "workspaces", "demo", "PROJECT_STATE.md"))).resolves.toBeTruthy();
  });

  it("preserves active workspace until use is called", async () => {
    const rootDir = await tempRoot();
    await fs.mkdir(path.join(rootDir, "one"), { recursive: true });
    await fs.mkdir(path.join(rootDir, "two"), { recursive: true });
    const store = new WorkspaceStore(rootDir);

    await store.create({ workspace: "one", repoPath: "one" });
    await store.create({ workspace: "two", repoPath: "two" });
    expect((await store.status()).current).toBe("one");

    await store.use("two");
    expect((await new WorkspaceStore(rootDir).current())?.workspace).toBe("two");
    expect((await new WorkspaceContext(rootDir).resolve({ workspace: "current" })).workspace).toBe("two");
  });

  it("fails cleanly for invalid repo paths and workspace names", async () => {
    const rootDir = await tempRoot();
    const store = new WorkspaceStore(rootDir);

    await expect(store.create({ workspace: "bad/name", repoPath: "." })).rejects.toThrow(/Workspace names/);
    await expect(store.create({ workspace: "missing", repoPath: "nope" })).rejects.toThrow(/does not exist/);
  });
});
