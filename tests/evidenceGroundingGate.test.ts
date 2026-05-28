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

  it("does not absorb report prose into command claims", () => {
    const result = new EvidenceGroundingGate().evaluate({
      output: [
        "Commands run: npm test.",
        "Command output summary with exit codes: STAX collected npm test with exit code 0 in <repo>.",
        "What is verified: npm test passed."
      ].join("\n"),
      repoEvidence,
      commandEvidence: [commandEvidence("local_stax_command_output")]
    });

    expect(new Set(result.claims.filter((claim) => claim.kind === "command").map((claim) => claim.text))).toEqual(new Set(["npm test"]));
    expect(result.weakClaims.filter((claim) => claim.kind === "command")).toEqual([]);
    expect(result.unsupportedClaims).toEqual([]);
  });

  it("does not treat URLs or prose slash phrases as repo file-path claims", () => {
    const result = new EvidenceGroundingGate().evaluate({
      output: [
        "Live fetch https://forensics25.web.app/main.js passed.",
        "Hosted image https://storage.googleapis.com/course-assets/unit/hero.png loaded.",
        "Reference link https://upload.wikimedia.org/wikipedia/commons/a/aa/example.svg is external.",
        "Weak notes mention workspace/export, proof/protocol, and behavior/source/release.",
        "The real changed file is src/index.ts."
      ].join("\n"),
      repoEvidence
    });

    expect(result.claims.filter((claim) => claim.kind === "file_path").map((claim) => claim.text)).toEqual(["src/index.ts"]);
    expect(result.unsupportedClaims.map((claim) => claim.text).join("\n")).not.toContain("workspace/export");
    expect(result.unsupportedClaims.map((claim) => claim.text).join("\n")).not.toContain("forensics25.web.app/main.js");
    expect(result.unsupportedClaims.map((claim) => claim.text).join("\n")).not.toContain("storage.googleapis.com/course-assets/unit/hero.png");
    expect(result.unsupportedClaims.map((claim) => claim.text).join("\n")).not.toContain("upload.wikimedia.org/wikipedia/commons/a/aa/example.svg");
  });

  it("grounds basename-only file references when they uniquely map to a known repo path", () => {
    const result = new EvidenceGroundingGate().evaluate({
      output: [
        "Files changed:",
        "- docs/releases/ROLLOUT_PHASE_GATE/report.md",
        "- docs/releases/ROLLOUT_PHASE_GATE/status.json",
        "What is verified:",
        "- report.md and status.json were refreshed."
      ].join("\n"),
      repoEvidence: {
        ...repoEvidence,
        docsFiles: [
          "docs/releases/ROLLOUT_PHASE_GATE/report.md",
          "docs/releases/ROLLOUT_PHASE_GATE/status.json"
        ]
      }
    });

    expect(result.unsupportedClaims.map((claim) => claim.text)).not.toContain("status.json");
    expect(result.supportedClaims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "file_path",
          text: "status.json",
          support: "repo_evidence_pack_basename"
        })
      ])
    );
  });

  it("keeps ambiguous basename-only file references unsupported", () => {
    const result = new EvidenceGroundingGate().evaluate({
      output: "index.ts was refreshed.",
      repoEvidence: {
        ...repoEvidence,
        sourceFiles: ["src/index.ts", "packages/demo/index.ts"]
      }
    });

    expect(result.unsupportedClaims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "file_path",
          text: "index.ts"
        })
      ])
    );
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
