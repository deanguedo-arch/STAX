import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { auditEvalFixture, auditEvalFixtures } from "../src/evals/EvalFixtureAudit.js";

describe("eval fixture audit", () => {
  it("flags broad single-token forbidden patterns for project_control fixtures", () => {
    const issues = auditEvalFixture("/tmp/case.json", {
      id: "project_control_case",
      mode: "project_control",
      forbiddenPatterns: ["complete", "promotion_ready"]
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain("too broad");
    expect(issues[0]?.fixtureId).toBe("project_control_case");
  });

  it("allows narrow phrase-level forbidden patterns for project_control fixtures", () => {
    const issues = auditEvalFixture("/tmp/case.json", {
      id: "project_control_case",
      mode: "project_control",
      forbiddenPatterns: ["status: promotion_ready", "Release gate (strict) passed"]
    });

    expect(issues).toEqual([]);
  });

  it("scans eval folders and reports issues with file context", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "eval-audit-"));
    const regressionDir = path.join(rootDir, "evals", "regression");
    await fs.mkdir(regressionDir, { recursive: true });
    await fs.writeFile(
      path.join(regressionDir, "bad.json"),
      JSON.stringify(
        {
          id: "bad_case",
          mode: "project_control",
          forbiddenPatterns: ["complete"]
        },
        null,
        2
      ),
      "utf8"
    );

    const summary = await auditEvalFixtures({ rootDir, folders: ["regression"] });
    expect(summary.checkedFiles).toBe(1);
    expect(summary.issueCount).toBe(1);
    expect(summary.issues[0]?.fixtureId).toBe("bad_case");
    expect(summary.issues[0]?.file.endsWith("bad.json")).toBe(true);
  });
});
