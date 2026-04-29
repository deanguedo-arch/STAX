import { describe, expect, it } from "vitest";
import { EvidenceGroundingGate } from "../src/evidence/EvidenceGroundingGate.js";
import type { CommandEvidence } from "../src/evidence/CommandEvidenceStore.js";
import type { RepoEvidencePack } from "../src/workspace/RepoEvidenceSchemas.js";

describe("EvidenceGroundingGate", () => {
  const repoEvidence: RepoEvidencePack = {
    repoPath: "/tmp/repo",
    workspace: "demo",
    workspaceResolution: "current_repo",
    createdAt: "2026-04-28T00:00:00.000Z",
    inspectedFiles: ["package.json"],
    importantFiles: ["package.json", "src/index.ts", "tests/index.test.ts"],
    configFiles: ["package.json"],
    sourceFiles: ["src/index.ts"],
    testFiles: ["tests/index.test.ts"],
    docsFiles: [],
    operationalFiles: [],
    scripts: [{ name: "test", command: "vitest" }],
    missingExpectedFiles: [],
    riskFlags: [],
    skippedPaths: [],
    redactions: [],
    snippets: [],
    markdown: "## Repo Evidence Pack"
  };

  it("supports file claims only when the file appears in repo evidence", () => {
    const result = new EvidenceGroundingGate().evaluate({
      output: "Inspect src/index.ts and src/missing.ts.",
      repoEvidence
    });

    expect(result.supportedClaims.map((claim) => claim.text)).toContain("src/index.ts");
    expect(result.unsupportedClaims.map((claim) => claim.text)).toContain("src/missing.ts");
    expect(result.pass).toBe(false);
  });

  it("requires local STAX command evidence for passed-test claims", () => {
    const result = new EvidenceGroundingGate().evaluate({
      output: "npm test passed.",
      repoEvidence,
      commandEvidence: []
    });

    expect(result.unsupportedClaims[0]?.kind).toBe("test_pass");
    expect(result.requiredFixes[0]).toContain("unsupported");
  });

  it("treats Codex-reported command output as weak proof, not strong proof", () => {
    const result = new EvidenceGroundingGate().evaluate({
      output: "npm test passed.",
      repoEvidence,
      commandEvidence: [commandEvidence("codex_reported_command_output")]
    });

    expect(result.unsupportedClaims.some((claim) => claim.kind === "test_pass")).toBe(true);
    expect(result.pass).toBe(false);
    expect(result.requiredFixes.join(" ")).toContain("unsupported");
  });

  it("allows Codex-reported command output only when phrased as provisional evidence", () => {
    const result = new EvidenceGroundingGate().evaluate({
      output: "Codex reported npm test passed; treat this as provisional until local STAX command evidence exists.",
      repoEvidence,
      commandEvidence: [commandEvidence("codex_reported_command_output")]
    });

    expect(result.weakClaims.some((claim) => claim.kind === "test_pass")).toBe(true);
    expect(result.unsupportedClaims).toEqual([]);
    expect(result.pass).toBe(true);
  });

  it("supports passed-test claims from local STAX command evidence", () => {
    const result = new EvidenceGroundingGate().evaluate({
      output: "npm test passed.",
      repoEvidence,
      commandEvidence: [commandEvidence("local_stax_command_output")]
    });

    expect(result.supportedClaims.some((claim) => claim.kind === "test_pass")).toBe(true);
    expect(result.pass).toBe(true);
  });
});

function commandEvidence(source: CommandEvidence["source"]): CommandEvidence {
  return {
    commandEvidenceId: `cmd-${source}`,
    command: "npm test",
    args: ["test"],
    exitCode: 0,
    success: true,
    source,
    status: "passed",
    commandFamily: "test",
    stdoutPath: "stdout.txt",
    stderrPath: "stderr.txt",
    stdoutTruncated: false,
    stderrTruncated: false,
    redactionCount: 0,
    summary: "npm test passed",
    createdAt: "2026-04-28T00:00:00.000Z",
    hash: source
  };
}
