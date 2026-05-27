import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditRepoHygiene, formatRepoHygieneAudit } from "../src/hardening/RepoHygieneAudit.js";

describe("repo hygiene audit", () => {
  it("passes the hardened STAX repository surface", () => {
    const result = auditRepoHygiene(process.cwd());
    expect(result.valid).toBe(true);
    expect(formatRepoHygieneAudit(result)).toContain("Repo hygiene audit: passed");
  });

  it("fails closed when required files and scripts are missing", () => {
    const root = mkdtempSync(join(tmpdir(), "stax-hygiene-"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ scripts: {}, engines: { node: ">=20" } }, null, 2)
    );
    writeFileSync(join(root, ".env.example"), `OPENAI_API_KEY=${"sk-"}thisshouldfail000\n`);

    const result = auditRepoHygiene(root);
    expect(result.valid).toBe(false);
    expect(result.findings.map((finding) => finding.code)).toContain("missing-required-file");
    expect(result.findings.map((finding) => finding.code)).toContain("missing-required-script");
    expect(result.findings.map((finding) => finding.code)).toContain("missing-node-engine");
    expect(result.findings.map((finding) => finding.code)).toContain("unsafe-env-example");
  });
});
