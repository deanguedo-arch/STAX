import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/core/ConfigLoader.js";

describe("repo audit and config", () => {
  it("has the required repo audit", async () => {
    const audit = await fs.readFile("docs/RAX_REPO_AUDIT.md", "utf8");

    expect(audit).toContain("## Existing Stack");
    expect(audit).toContain("## Integration Decision");
    expect(audit).toContain("integrate RAX into existing `src/`");
  });

  it("loads the STAX/RAX config defaults", async () => {
    const config = await loadConfig(process.cwd());

    expect(config.runtime.name).toBe("STAX/RAX");
    expect(config.model.provider).toBe("mock");
    expect(config.training.enableSftExport).toBe(true);
    expect(config.memory.autoSaveModelOutputs).toBe(false);
  });
});
