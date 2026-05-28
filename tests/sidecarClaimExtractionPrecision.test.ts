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

  it("does not convert weak/provisional caution language into hard claims", () => {
    expect(
      decomposeClaimsFromReport([
        "Objective:",
        "Run a local observer proof pass.",
        "",
        "What is weak/provisional:",
        "- This observer pass proves only the local page-build path, not live sync, publish, deploy, sheet writes, source data correctness, or visual readiness.",
        "- The build command changed generated tracked output, so the repo needs a human decision.",
        "",
        "What is verified:",
        "- Local build command evidence exists."
      ].join("\n"))
    ).toEqual([]);
  });

  it("keeps explicit negative claims negative", () => {
    expect(decomposeClaimsFromReport("This does not enable live blocking.")).toEqual([]);
  });

  it("keeps do-not bullet lists negative", () => {
    expect(
      decomposeClaimsFromReport([
        "Do not:",
        "- deploy, publish, sync, push, or auto-promote anything.",
        "- treat this as release ready.",
        "",
        "The work is a local-only report update."
      ].join("\n"))
    ).toEqual([]);
  });

  it("does not treat proof-prevention wording as the prevented claim", () => {
    expect(
      decomposeClaimsFromReport(
        'Additional adversarial cases prevent "exists" language from becoming proof of passed CI, deploy readiness, real config, preflight pass, screenshot pass, or acceptable coverage.'
      )
    ).toEqual([]);
  });

  it("does not convert workflow status receipts into implementation claims", () => {
    expect(
      decomposeClaimsFromReport(
        [
          "What is verified:",
          "- GitHub Actions run 26591243938 completed successfully.",
          "- staxcore-strict completed / success for b2eef94.",
          "- The CI URL records a green workflow run."
        ].join("\n")
      )
    ).toEqual([]);
  });

  it("still treats direct CI-green wording as a proof-bearing test claim", () => {
    expect(decomposeClaimsFromReport("CI is green.")).toEqual([
      { claimType: "test", claim: "Tests passed.", hardClaim: true }
    ]);
  });

  it("does not treat proof-rule wording as the claim being governed", () => {
    expect(
      decomposeClaimsFromReport(
        "Visual/course behavior claims should require rendered screenshot or checklist proof; source or CSS diffs alone are not enough."
      )
    ).toEqual([]);
    expect(
      decomposeClaimsFromReport(
        "Suggested regression eval: A visual fix report with only CSS diff evidence must be marked unverified."
      )
    ).toEqual([]);
  });

  it("does not treat visual-proof tooling or fallback wording as a visual completion claim", () => {
    expect(
      decomposeClaimsFromReport(
        "Make STAX visual proof URL-capture failures actionable by telling Codex to fall back to registering an existing screenshot with stax:collect-visual --path when repo-local Playwright capture is unavailable."
      )
    ).toEqual([]);
    expect(
      decomposeClaimsFromReport("URL visual-proof capture now wraps repo-local Playwright failures with an actionable message.")
    ).toEqual([]);
    expect(
      decomposeClaimsFromReport("For visual proof, use stax:collect-visual --path when Playwright is unavailable.")
    ).toEqual([]);
  });

  it("does not convert negative promotion-control wording into memory promotion claims", () => {
    expect(decomposeClaimsFromReport("Do not auto-promote learning candidates.")).toEqual([]);
    expect(decomposeClaimsFromReport("Candidates are pending review only; none were promoted.")).toEqual([]);
    expect(decomposeClaimsFromReport("No sidecar learning candidate was promoted.")).toEqual([]);
    expect(decomposeClaimsFromReport("Negative promotion-control language now stays negative instead of triggering a memory-promotion proof claim.")).toEqual([]);
    expect(decomposeClaimsFromReport("Existing repo-memory candidates still need human review before any durable promotion.")).toEqual([]);
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
