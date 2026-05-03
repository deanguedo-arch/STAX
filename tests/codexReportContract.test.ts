import { describe, expect, it } from "vitest";
import { analyzeCodexReportContract } from "../src/projectControl/CodexReportContract.js";

describe("codex report contract", () => {
  it("marks a well-formed report as well formed", () => {
    const result = analyzeCodexReportContract([
      "Files changed: src/agents/AnalystAgent.ts, tests/projectControlMode.test.ts",
      "Commands run: npm test (exit code 0)",
      "What is verified: targeted tests passed with local output",
      "What is unverified: broader behavior outside this test slice",
      "Risks: visual behavior not checked"
    ].join("\n"));

    expect(result.status).toBe("well_formed");
    expect(result.issues).toEqual([]);
  });

  it("marks a one-line fake-complete report as malformed", () => {
    const result = analyzeCodexReportContract("I fixed it and tests passed.");

    expect(result.status).toBe("malformed");
    expect(result.issues.join("\n")).toContain("missing sections");
  });

  it("marks a partially structured report as partial", () => {
    const result = analyzeCodexReportContract([
      "Files changed: src/agents/AnalystAgent.ts",
      "Commands run: npm test",
      "What is verified: unit test file changed"
    ].join("\n"));

    expect(result.status).toBe("partial");
    expect(result.missingSections).toContain("what_is_unverified");
    expect(result.missingSections).toContain("risks");
  });
});
