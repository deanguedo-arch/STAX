import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../src/memory/MemoryStore.js";
import { Retrieval } from "../src/memory/Retrieval.js";

describe("MemoryStore and Retrieval", () => {
  it("stores and retrieves local memory records", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-memory-"));
    const store = new MemoryStore(rootDir);
    await store.add("project", "RAX uses mock mode first.", ["provider"]);

    const retrieval = new Retrieval(store);
    const results = await retrieval.retrieve("mock");

    expect(results).toEqual(["RAX uses mock mode first."]);
  });
});
