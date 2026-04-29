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
    const record = await store.add("project", "RAX uses mock mode first.", ["provider"]);
    await store.approve(record.id, {
      approvedBy: "test",
      approvalReason: "Stable project preference for retrieval test.",
      neverExpireJustification: "Test fixture memory."
    });

    const retrieval = new Retrieval(store);
    const results = await retrieval.retrieve("mock");

    expect(results).toEqual(["RAX uses mock mode first."]);
  });

  it("keeps simple memory writes pending by default", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-memory-"));
    const store = new MemoryStore(rootDir);
    await store.add("project", "Raw model output should not be approved.", ["poison"]);

    const results = await store.search("poison");

    expect(results).toEqual([]);
  });

  it("requires approval metadata before memory can become approved", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-memory-"));
    const store = new MemoryStore(rootDir);
    const record = await store.add("project", "Needs approval metadata.", ["approval"]);

    await expect(
      store.approve(record.id, {
        approvedBy: "test",
        approvalReason: "",
        neverExpireJustification: "Test fixture memory."
      })
    ).rejects.toThrow("approvalReason");
  });
});
