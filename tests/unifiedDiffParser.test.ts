import { describe, expect, it } from "vitest";
import { loadUnifiedDiffFixtureCases, parseUnifiedDiff } from "../src/diffAudit/UnifiedDiffParser.js";

describe("unified diff parser", () => {
  it("keeps the 100-case unified diff fixture gate live", async () => {
    const cases = await loadUnifiedDiffFixtureCases();
    expect(cases).toHaveLength(100);
  });

  it("parses unified diff fixtures into typed file changes", async () => {
    const cases = await loadUnifiedDiffFixtureCases();
    for (const testCase of cases) {
      const parsed = parseUnifiedDiff(testCase.diff);
      expect(parsed.length, testCase.caseId).toBeGreaterThan(0);
      const first = parsed[0]!;
      expect(first.path, testCase.caseId).toBe(testCase.expected.path);
      expect(first.changeType, testCase.caseId).toBe(testCase.expected.changeType);
      expect(first.fileRole, testCase.caseId).toBe(testCase.expected.fileRole);
      if (testCase.expected.oldPath !== undefined) {
        expect(first.oldPath, testCase.caseId).toBe(testCase.expected.oldPath);
      }
      if (testCase.expected.newPath !== undefined) {
        expect(first.newPath, testCase.caseId).toBe(testCase.expected.newPath);
      }
      if (testCase.expected.isBinary !== undefined) {
        expect(first.isBinary, testCase.caseId).toBe(testCase.expected.isBinary);
      }
      if (testCase.expected.isRename !== undefined) {
        expect(first.isRename, testCase.caseId).toBe(testCase.expected.isRename);
      }
      if (testCase.expected.isCopy !== undefined) {
        expect(first.isCopy, testCase.caseId).toBe(testCase.expected.isCopy);
      }
      if (testCase.expected.modeChanged !== undefined) {
        expect(first.modeChanged, testCase.caseId).toBe(testCase.expected.modeChanged);
      }
    }
  });

  it("counts added and deleted lines from hunks", () => {
    const parsed = parseUnifiedDiff([
      "diff --git a/src/example.ts b/src/example.ts",
      "--- a/src/example.ts",
      "+++ b/src/example.ts",
      "@@ -1,2 +1,3 @@",
      "-old",
      "+new",
      "+more"
    ].join("\n"));

    expect(parsed[0]?.addedLines).toBe(3);
    expect(parsed[0]?.deletedLines).toBe(2);
  });
});
