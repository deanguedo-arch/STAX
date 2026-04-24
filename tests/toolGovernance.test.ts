import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FileReadTool } from "../src/tools/FileReadTool.js";
import { FileWriteTool } from "../src/tools/FileWriteTool.js";
import { GitTool } from "../src/tools/GitTool.js";
import { ShellTool } from "../src/tools/ShellTool.js";

describe("tool governance", () => {
  it("allows file reads inside the repo root", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "rax-tools-"));
    await fs.writeFile(path.join(root, "input.txt"), "safe", "utf8");

    const result = await new FileReadTool(root).run("input.txt");

    expect(result.ok).toBe(true);
    expect(result.output).toBe("safe");
  });

  it("denies file reads outside the repo root", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "rax-tools-"));
    const outside = path.join(os.tmpdir(), `rax-outside-${Date.now()}.txt`);
    await fs.writeFile(outside, "no", "utf8");

    const result = await new FileReadTool(root).run(outside);

    expect(result.ok).toBe(false);
    expect(result.output).toContain("denied");
  });

  it("keeps file write disabled by default", async () => {
    const result = await new FileWriteTool().run(
      JSON.stringify({ path: "x.txt", content: "no" })
    );

    expect(result.ok).toBe(false);
    expect(result.output).toContain("disabled");
  });

  it("keeps shell disabled by default", async () => {
    const result = await new ShellTool().run("node --version");

    expect(result.ok).toBe(false);
    expect(result.output).toContain("disabled");
  });

  it("keeps git mutation disabled by default", async () => {
    const result = await new GitTool().run("commit -am test");

    expect(result.ok).toBe(false);
    expect(result.output).toContain("does not auto-commit");
  });
});
