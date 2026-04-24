import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../src/memory/MemoryStore.js";

describe("Memory approval", () => {
  it("retrieves only approved, non-expired memory", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-memory-approval-"));
    const store = new MemoryStore(rootDir);
    await store.add({
      type: "project",
      content: "Approved project rule",
      confidence: "high",
      approved: true,
      tags: ["rule"]
    });
    await store.add({
      type: "project",
      content: "Unapproved model output",
      confidence: "low",
      approved: false,
      tags: ["rule"]
    });

    const results = await store.search("rule");

    expect(results.map((item) => item.content)).toEqual(["Approved project rule"]);
  });
});
