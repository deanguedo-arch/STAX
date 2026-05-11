import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  attachStaxToRepo,
  STAX_AGENTS_SECTION_END_MARKER,
  STAX_AGENTS_SECTION_MARKER,
  STAX_CONFIDENCE_REPORT_RELATIVE_PATH,
  STAX_PROOF_REPORT_RELATIVE_PATH,
  upsertAgentsProtocolSection
} from "../src/sidecar/AttachStax.js";
import { collectCommandEvidence } from "../src/sidecar/CommandEvidenceCollector.js";
import { getNextCodexPrompt } from "../src/sidecar/NextCodexPrompt.js";
import { runStaxGate } from "../src/sidecar/StaxGate.js";
import { commitFile, createTempGitRepo } from "./sidecarTestHelpers.js";

function useTestExternalEvidenceRoot(repoPath: string): void {
  process.env.STAX_EVIDENCE_ROOT = path.join(repoPath, "..", `${path.basename(repoPath)}-external-evidence`);
}

describe("STAX sidecar attach and gate", () => {
  afterEach(() => {
    delete process.env.STAX_EVIDENCE_ROOT;
  });

  it("attaches idempotently and does not overwrite existing AGENTS.md", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-attach-");
    await fs.writeFile(path.join(repoPath, "AGENTS.md"), "# Existing Instructions\n\nKeep this.\n", "utf8");

    const first = await attachStaxToRepo(repoPath);
    const second = await attachStaxToRepo(repoPath);
    const agents = await fs.readFile(path.join(repoPath, "AGENTS.md"), "utf8");

    expect(first.sidecarPath).toBe(path.join(repoPath, ".stax"));
    expect(second.appendedAgentsProtocol).toBe(false);
    expect(agents).toContain("Keep this.");
    expect(agents).toContain("read `.stax/next-codex-prompt.md`");
    expect(agents.match(new RegExp(STAX_AGENTS_SECTION_MARKER, "g"))?.length).toBe(1);
    expect(agents.match(new RegExp(STAX_AGENTS_SECTION_END_MARKER, "g"))?.length).toBe(1);
    const config = JSON.parse(await fs.readFile(path.join(repoPath, ".stax", "config.json"), "utf8")) as {
      requireFreshCodexTurnCapture?: boolean;
      runtimeFreshnessMode?: string;
      turnComplianceMode?: string;
      commandEvidenceStore?: string;
      commandEvidenceRepoId?: string;
    };
    const gitignore = await fs.readFile(path.join(repoPath, ".gitignore"), "utf8");
    await expect(fs.stat(path.join(repoPath, ".stax", "config.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "command-evidence"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "events"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "reports"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "runtime"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "turns"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "turn-contract.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "reports", "latest-proof-report.md"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "reports", "latest-confidence-report.md"))).resolves.toBeTruthy();
    expect(config.requireFreshCodexTurnCapture).toBe(false);
    expect(config.runtimeFreshnessMode).toBe("normal");
    expect(config.turnComplianceMode).toBe("normal");
    expect(config.commandEvidenceStore).toBe("external_user_store");
    expect(config.commandEvidenceRepoId).toMatch(/^stax-sidecar-attach-/);
    expect(gitignore).toContain(".stax/*");
    expect(gitignore).toContain("!.stax/status.json");
    expect(gitignore).toContain("!.stax/proof_strength.json");
    expect(gitignore).toContain("!.stax/reports/latest-proof-report.md");
    expect(gitignore).toContain("!.stax/reports/latest-confidence-report.md");
  });

  it("updates an existing protocol section instead of appending duplicate stale protocol", () => {
    const existing = [
      "# Existing",
      "",
      STAX_AGENTS_SECTION_MARKER,
      "# Old STAX Protocol",
      "Do old things."
    ].join("\n");

    const updated = upsertAgentsProtocolSection(existing);

    expect(updated).toContain("# Existing");
    expect(updated).toContain("read `.stax/next-codex-prompt.md`");
    expect(updated).not.toContain("Do old things.");
    expect(updated.match(new RegExp(STAX_AGENTS_SECTION_MARKER, "g"))?.length).toBe(1);
  });

  it("rejects a diff with a missing Codex report and writes sidecar status", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-missing-report-");
    await attachStaxToRepo(repoPath);
    await commitFile(repoPath, "src/app.ts", "export const value = 1;\n");
    await fs.writeFile(path.join(repoPath, "src/app.ts"), "export const value = 2;\n", "utf8");

    const status = await runStaxGate({ repoPath });

    expect(status.verdict).toBe("Reject");
    expect(status.exitCode).toBe(1);
    expect(status.statusMarkdown).toContain("Diff exists but .stax/codex-report.md is missing");
    await expect(fs.stat(path.join(repoPath, ".stax", "status.md"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "status.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "next-codex-prompt.md"))).resolves.toBeTruthy();
  });

  it("writes a compact proof-strength summary into the Codex report even when proof-strength is unavailable", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-no-proof-strength-summary-");
    await attachStaxToRepo(repoPath);

    const status = await runStaxGate({ repoPath });
    const codexReport = await fs.readFile(path.join(repoPath, ".stax", "codex-report.md"), "utf8");

    expect(status.proofStrength).toBeUndefined();
    expect(codexReport).toContain("## STAX Proof Strength");
    expect(codexReport).toContain("- Summary: No formal proof-strength artifact was generated for this gate run.");
    expect(codexReport).toContain(`- Proof report: ${STAX_PROOF_REPORT_RELATIVE_PATH}`);
    expect(codexReport).toContain(`- Confidence report: ${STAX_CONFIDENCE_REPORT_RELATIVE_PATH}`);
  });

  it("makes missing runtime capture provisional by default", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-missing-turn-");
    await attachStaxToRepo(repoPath);

    const status = await runStaxGate({ repoPath, writeLearningEvent: false });

    expect(status.verdict).toBe("Provisional");
    expect(status.weak.join("\n")).toContain("Fresh Codex turn capture is missing");
    expect(status.risk.join("\n")).not.toContain("False Pass risk");
  });

  it("returns the next Codex prompt after running the gate", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-next-prompt-");
    await attachStaxToRepo(repoPath);
    await commitFile(repoPath, "src/app.ts", "export const value = 1;\n");
    await fs.writeFile(path.join(repoPath, "src/app.ts"), "export const value = 2;\n", "utf8");

    const result = await getNextCodexPrompt({ repoPath, runGate: true });

    expect(result.copied).toBe(false);
    expect(result.prompt).toContain("STAX Sidecar rejected or held this task");
    expect(result.prompt).toContain("Update .stax/codex-report.md");
  });

  it("rejects fake-complete reports without local command evidence", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-fake-complete-");
    execFileSync("git", ["checkout", "-b", "codex/resume-test-branch"], { cwd: repoPath });
    await attachStaxToRepo(repoPath);
    await commitFile(repoPath, "src/app.ts", "export const value = 1;\n");
    await fs.writeFile(path.join(repoPath, "src/app.ts"), "export const value = 3;\n", "utf8");
    await fs.writeFile(
      path.join(repoPath, ".stax", "codex-report.md"),
      [
        "Objective: update app",
        "Branch: codex/resume-test-branch",
        "Files changed: src/app.ts, .stax/status.json, AGENTS.md",
        "Tests added: none",
        "Commands run: npm test",
        "Command output summary with exit codes: tests passed",
        "What is verified: done and complete",
        "What is weak/provisional: same branch/head",
        "What is unverified: none",
        "Risks: none",
        "One next action: accept"
      ].join("\n"),
      "utf8"
    );

    const status = await runStaxGate({ repoPath });

    expect(status.verdict).toBe("Reject");
    expect(status.unverified.join("\n")).toMatch(/completion without local STAX command evidence|Tests-passed claim/);
    expect(status.proofStrength?.capApplied.map((cap) => cap.id)).toContain("missing_command_evidence");
    expect(status.proofStrength?.missingProof.join("\n")).not.toMatch(/stax\/status\.json|AGENTS\.md|codex\/resume-test-branch|branch\/head/);
    expect(status.statusMarkdown).toContain("## Proof Strength");
    expect(status.statusMarkdown).toContain("- Artifact: .stax/proof_strength.json");
    const proofStrengthArtifact = JSON.parse(
      await fs.readFile(path.join(repoPath, ".stax", "proof_strength.json"), "utf8")
    ) as { label: string; capApplied: Array<{ id: string }> };
    expect(proofStrengthArtifact.label).toBe(status.proofStrength?.label);
    expect(proofStrengthArtifact.capApplied.map((cap) => cap.id)).toContain("missing_command_evidence");
    const reportWithProofStrength = await fs.readFile(path.join(repoPath, ".stax", "codex-report.md"), "utf8");
    expect(reportWithProofStrength).toContain("## STAX Proof Strength");
    expect(reportWithProofStrength).toContain("Generated by `stax gate`; this is STAX audit output, not a Codex completion claim.");
    expect(reportWithProofStrength).toContain("- Label: Missing");
    expect(reportWithProofStrength).toContain("- Caps Applied: missing_command_evidence");
    expect(reportWithProofStrength).toContain("- Artifact: .stax/proof_strength.json");
    const latestProofReport = await fs.readFile(path.join(repoPath, ".stax", "reports", "latest-proof-report.md"), "utf8");
    expect(latestProofReport).toContain("# STAX Proof Report");
    expect(latestProofReport).toContain("- Status: Reject");
    expect(latestProofReport).toContain("- Label: Missing");
    expect(latestProofReport).toContain("- Caps Applied: missing_command_evidence");
    expect(latestProofReport).toContain("- Proof strength JSON: .stax/proof_strength.json");
    expect(latestProofReport).not.toContain("STAX_ACK");
    const latestConfidenceReport = await fs.readFile(path.join(repoPath, ".stax", "reports", "latest-confidence-report.md"), "utf8");
    expect(latestConfidenceReport).toContain("# STAX Confidence Strength Report");
    expect(latestConfidenceReport).toContain("- Label: Missing");
    expect(latestConfidenceReport).toContain("- Raw Score:");
    expect(latestConfidenceReport).toContain("- Final Score:");
    expect(latestConfidenceReport).toContain("- Caps Applied: missing_command_evidence");
    expect(latestConfidenceReport).toContain("- Proof strength JSON: .stax/proof_strength.json");
    expect(latestConfidenceReport).not.toContain("STAX_ACK");

    const secondStatus = await runStaxGate({ repoPath });
    expect(secondStatus.proofStrength?.claimText).not.toContain("## STAX Proof Strength");
    expect(secondStatus.proofStrength?.capApplied.map((cap) => cap.id)).toContain("missing_command_evidence");
    const reportAfterSecondGate = await fs.readFile(path.join(repoPath, ".stax", "codex-report.md"), "utf8");
    expect(reportAfterSecondGate.match(/<!-- STAX:proof-strength:start -->/g)).toHaveLength(1);
  });

  it("reports proof strength for verified command evidence without hard completion wording", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-verification-run-");
    useTestExternalEvidenceRoot(repoPath);
    await attachStaxToRepo(repoPath);
    await fs.writeFile(
      path.join(repoPath, ".stax", "config.json"),
      `${JSON.stringify(
        {
          schemaVersion: "stax-sidecar-config-v1",
          runtimeFreshnessMode: "manual",
          turnComplianceMode: "manual"
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await commitFile(
      repoPath,
      "package.json",
      `${JSON.stringify({ scripts: { build: "node -e \"console.log('build ok')\"" } }, null, 2)}\n`
    );
    const evidence = await collectCommandEvidence({
      repoPath,
      command: ["npm", "run", "build"],
      writeLearningEvent: false
    });
    await fs.writeFile(
      path.join(repoPath, ".stax", "codex-report.md"),
      [
        "Objective: record local verification evidence",
        "Files changed: none",
        "Tests added: none",
        "Commands run: npm run build",
        `Command output summary with exit codes: ${evidence.evidenceId} exit code 0`,
        "What is verified: local command evidence was captured for the current repo state",
        "What is weak/provisional: none",
        "What is unverified: none",
        "Risks: none",
        "One next action: none"
      ].join("\n"),
      "utf8"
    );

    const status = await runStaxGate({ repoPath, writeLearningEvent: false });

    expect(status.verdict).toBe("Accept");
    expect(status.why).toContain("required claims are supported by verified evidence for this repo state");
    expect(status.why).toContain("does not certify general code correctness");
    expect(status.statusMarkdown).toContain("- Accept Boundary: Accept means required claims are supported by verified evidence for this repo state");
    expect(status.proofStrength?.claimType).toBe("verification_run");
    expect(status.proofStrength?.label === "Strong" || status.proofStrength?.label === "Audit-grade").toBe(true);
    expect(status.statusMarkdown).toContain("- Artifact: .stax/proof_strength.json");
    const artifact = JSON.parse(await fs.readFile(path.join(repoPath, ".stax", "proof_strength.json"), "utf8")) as { claimType: string; label: string };
    expect(artifact.claimType).toBe("verification_run");
    const reportWithProofStrength = await fs.readFile(path.join(repoPath, ".stax", "codex-report.md"), "utf8");
    expect(reportWithProofStrength).toContain("## STAX Proof Strength");
    expect(reportWithProofStrength).toContain("- Claim Type: verification_run");
    expect(reportWithProofStrength).toContain("- Accept Boundary: Accept means required claims are supported by verified evidence for this repo state");
    expect(reportWithProofStrength).toContain("- Confidence Report: .stax/reports/latest-confidence-report.md");
    const latestProofReport = await fs.readFile(path.join(repoPath, ".stax", "reports", "latest-proof-report.md"), "utf8");
    expect(latestProofReport).toContain("- Accept Boundary: Accept means required claims are supported by verified evidence for this repo state");
  });

  it("does not mark command evidence stale when only tracked sidecar proof artifacts advanced HEAD", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-proof-report-head-");
    useTestExternalEvidenceRoot(repoPath);
    await attachStaxToRepo(repoPath);
    await fs.writeFile(
      path.join(repoPath, ".stax", "config.json"),
      `${JSON.stringify(
        {
          schemaVersion: "stax-sidecar-config-v1",
          runtimeFreshnessMode: "manual",
          turnComplianceMode: "manual"
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    execFileSync("git", ["add", ".gitignore", "AGENTS.md", ".stax/status.json", ".stax/next-codex-prompt.md", ".stax/reports/latest-proof-report.md"], {
      cwd: repoPath
    });
    execFileSync("git", ["commit", "-m", "attach stax"], { cwd: repoPath });
    await commitFile(
      repoPath,
      "package.json",
      `${JSON.stringify({ scripts: { test: "node -e \"console.log('tests passed')\"" } }, null, 2)}\n`
    );
    await commitFile(repoPath, "src/app.ts", "export const value = 1;\n");
    const evidence = await collectCommandEvidence({
      repoPath,
      command: ["npm", "test"],
      writeLearningEvent: false
    });
    await fs.writeFile(
      path.join(repoPath, ".stax", "codex-report.md"),
      [
        "Objective: update app",
        "Files changed: src/app.ts",
        "Tests added: none",
        "Commands run: npm test",
        `Command output summary with exit codes: ${evidence.evidenceId} exit code 0`,
        "What is verified: implementation complete with local command proof",
        "What is weak/provisional: none",
        "What is unverified: none",
        "Risks: none",
        "One next action: accept"
      ].join("\n"),
      "utf8"
    );

    await runStaxGate({ repoPath, writeLearningEvent: false });
    execFileSync("git", ["add", ".stax/status.json", ".stax/proof_strength.json", ".stax/reports/latest-proof-report.md", ".stax/reports/latest-confidence-report.md"], {
      cwd: repoPath
    });
    execFileSync("git", ["commit", "-m", "track proof report"], { cwd: repoPath });

    const status = await runStaxGate({ repoPath, writeLearningEvent: false });

    expect(status.verdict).toBe("Accept");
    expect(status.risk.join("\n")).not.toContain("Stale command evidence");
    expect(status.verified.join("\n")).toContain("predates current head only by STAX sidecar artifact commits");
  });

  it("rejects docs-only implementation claims", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-docs-only-");
    await attachStaxToRepo(repoPath);
    await commitFile(repoPath, "docs/guide.md", "old docs\n");
    await fs.writeFile(path.join(repoPath, "docs/guide.md"), "new docs\n", "utf8");
    await fs.writeFile(
      path.join(repoPath, ".stax", "codex-report.md"),
      [
        "Objective: implement runtime behavior",
        "Files changed: docs/guide.md",
        "Tests added: none",
        "Commands run: none",
        "Command output summary with exit codes: none",
        "What is verified: implemented behavior and ready",
        "What is weak/provisional: no tests",
        "What is unverified: none",
        "Risks: none",
        "One next action: accept"
      ].join("\n"),
      "utf8"
    );

    const status = await runStaxGate({ repoPath });

    expect(status.verdict).toBe("Reject");
    expect(status.unverified.join("\n")).toContain("Docs-only diff cannot prove implementation");
  });
});
