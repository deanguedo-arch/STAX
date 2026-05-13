import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("current STAX status docs", () => {
  it("keeps one canonical current-status truth surface", async () => {
    const current = await fs.readFile(path.join(process.cwd(), "docs", "CURRENT_STATUS.md"), "utf8");

    expect(current).toContain("STAX is a scoped 9.5 local proof gate for Dean's Codex/repo project-control workflow.");
    expect(current).toContain("broad ChatGPT superiority");
    expect(current).toContain("production-ready autonomous agent");
    expect(current).toContain("real-repo auto-apply");
    expect(current).toContain("git push / deploy / publish authority");
    expect(current).toContain("code correctness proof");
    expect(current).toContain("stax:attach");
    expect(current).toContain("stax:collect");
    expect(current).toContain("stax:gate");
    expect(current).toContain("stax:next-prompt");
    expect(current).toContain("investor proof: STAX 7, ChatGPT 0, ties 3");
    expect(current).toContain("Phase B executable: STAX 7, ChatGPT 0, ties 13");
    expect(current).toContain("zero STAX critical misses in promotion window");
  });

  it("routes historical reports through the archive index instead of treating them as current truth", async () => {
    const archiveIndex = await fs.readFile(path.join(process.cwd(), "docs", "ARCHIVE_INDEX.md"), "utf8");
    const promotion = await fs.readFile(path.join(process.cwd(), "docs", "STAX_9_5_PROMOTION_REPORT.md"), "utf8");
    const realUse = await fs.readFile(path.join(process.cwd(), "docs", "RAX_REAL_USE_CAMPAIGN_REPORT.md"), "utf8");

    expect(archiveIndex).toContain("[CURRENT_STATUS.md](./CURRENT_STATUS.md)");
    expect(archiveIndex).toContain("Historical reports are evidence records");
    expect(promotion).toContain("Historical report. Current status lives in [CURRENT_STATUS.md](./CURRENT_STATUS.md).");
    expect(realUse).toContain("Historical report. Current status lives in [CURRENT_STATUS.md](./CURRENT_STATUS.md).");
  });
});
