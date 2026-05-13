import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decomposeClaimsFromReport, mapClaimToProof } from "../src/claims/ClaimProofMapping.js";
import { attachStaxToRepo } from "../src/sidecar/AttachStax.js";
import { runStaxGate } from "../src/sidecar/StaxGate.js";
import { commitFile, createTempGitRepo } from "./sidecarTestHelpers.js";

describe("sidecar claim extraction precision", () => {
  it("does not convert command names into proof-bearing claims", () => {
    expect(decomposeClaimsFromReport("Run npm run build and npm run ingest:ci.")).toEqual([]);
  });

  it("does not convert file paths into release claims", () => {
    expect(decomposeClaimsFromReport("Reference: docs/releases/v1.md")).toEqual([]);
  });

  it("does not convert risk or unverified lines into completion claims", () => {
    expect(decomposeClaimsFromReport(["Risk: deploy could be unsafe", "Unverified: sync readiness"].join("\n"))).toEqual([]);
  });

  it("keeps explicit negative claims negative", () => {
    expect(decomposeClaimsFromReport("This does not enable live blocking.")).toEqual([]);
  });

  it("does not convert sidecar upgrade wording into dependency claims", () => {
    expect(decomposeClaimsFromReport("Sidecar upgrade propagated the prompt contract.")).toEqual([]);
  });

  it("ignores generated STAX proof-strength summaries during claim extraction", () => {
    expect(decomposeClaimsFromReport([
      "STAX acknowledgement: STAX_ACK example",
      "<!-- STAX:proof-strength:start -->",
      "## STAX Proof Strength",
      "- Claim Type: visual_behavior_verified",
      "- Caps Applied: visual_claim_without_visual_proof",
      "- Next Proof Action: Capture rendered visual proof.",
      "<!-- STAX:proof-strength:end -->"
    ].join("\n"))).toEqual([{ claimType: "protocol_compliance", claim: "Protocol compliance claim.", hardClaim: true }]);
  });

  it("still extracts real proof-bearing completion claims", () => {
    expect(decomposeClaimsFromReport("All tests passed. Build succeeded. Ingest is fixed. Ready to publish.")).toEqual([
      { claimType: "implementation", claim: "Implementation is complete.", hardClaim: true },
      { claimType: "test", claim: "Tests passed.", hardClaim: true },
      { claimType: "release_deploy", claim: "Release/deploy readiness claim.", hardClaim: true }
    ]);
  });

  it("marks source-qualified Codex claims as provisional unless proof is supplied", () => {
    const claims = decomposeClaimsFromReport("Codex says tests passed.");
    expect(claims).toEqual([{ claimType: "test", claim: "Tests passed.", hardClaim: false }]);

    const mapped = mapClaimToProof({ ...claims[0], suppliedProof: [] });
    expect(mapped.verdict).toBe("provisional");
    expect(mapped.unsupportedHardClaim).toBe(false);
  });

  it("blocks wrong-repo command evidence from verifying the target repo", async () => {
    const repoPath = await createTempGitRepo("stax-claim-wrong-repo-");
    await attachStaxToRepo(repoPath);
    await commitFile(repoPath, "src/app.ts", "export const value = 1;\n");
    await fs.writeFile(path.join(repoPath, "src", "app.ts"), "export const value = 2;\n", "utf8");
    await fs.writeFile(
      path.join(repoPath, ".stax", "codex-report.md"),
      [
        "Objective: update app",
        "Files changed: src/app.ts",
        "Tests added: none",
        "Commands run: npm test",
        "Command output summary with exit codes: npm test exited 0",
        "What is verified: All tests passed.",
        "What is weak/provisional: none.",
        "What is unverified: none.",
        "Risks: none.",
        "One next action: accept."
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(repoPath, ".stax", "command-evidence", "cmd_wrong_repo.json"),
      `${JSON.stringify(
        {
          evidenceId: "cmd_wrong_repo",
          command: "npm test",
          cwd: repoPath,
          repo: "other-repo",
          branch: "main",
          commitSha: "wrong",
          exitCode: 0,
          source: "local_stax_command_output",
          stdout: "tests passed",
          stderr: ""
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const status = await runStaxGate({ repoPath, writeLearningEvent: false });

    expect(status.verdict).toBe("Reject");
    expect([...status.unverified, ...status.risk].join("\n")).toContain("Wrong repo command proof blocked");
  });
});
