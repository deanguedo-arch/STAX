import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { attachStaxToRepo } from "../src/sidecar/AttachStax.js";
import { verifyProtocolCompliance } from "../src/sidecar/ProtocolComplianceVerifier.js";
import { runStaxGate } from "../src/sidecar/StaxGate.js";
import {
  canPreflightApprovalSatisfy,
  inferPreflightBoundaryFromCommand,
  resolvePreflightPolicy,
  runStaxPreflight
} from "../src/sidecar/StaxPreflight.js";
import { readTurnContract } from "../src/sidecar/TurnContract.js";
import { createTempGitRepo } from "./sidecarTestHelpers.js";

async function writeReport(repoPath: string, text: string): Promise<void> {
  await fs.writeFile(path.join(repoPath, ".stax", "codex-report.md"), text, "utf8");
}

async function updateSidecarConfig(repoPath: string, patch: Record<string, unknown>): Promise<void> {
  const configPath = path.join(repoPath, ".stax", "config.json");
  const config = JSON.parse(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
  await fs.writeFile(configPath, `${JSON.stringify({ ...config, ...patch }, null, 2)}\n`, "utf8");
}

describe("STAX protocol compliance and preflight", () => {
  afterEach(() => {
    delete process.env.STAX_EVIDENCE_ROOT;
  });

  it("reports missing required Codex report sections as protocol warnings", async () => {
    const repoPath = await createTempGitRepo("stax-protocol-sections-");
    await attachStaxToRepo(repoPath);
    const contract = await readTurnContract(repoPath);
    expect(contract).toBeTruthy();
    const report = [
      `STAX acknowledgement: ${contract?.requiredAcknowledgement}`,
      "Objective: Check protocol fields.",
      ""
    ].join("\n");

    const result = await verifyProtocolCompliance({
      repoPath,
      codexReportText: report,
      mode: "normal"
    });

    expect(result.status).toBe("warning");
    expect(result.acknowledgedTurnContract).toBe(true);
    expect(result.missingRequiredSections).toContain("Commands run");
  });

  it("gate records protocol failure when Codex claims STAX compliance without the current ACK", async () => {
    const repoPath = await createTempGitRepo("stax-protocol-claimed-no-ack-");
    await attachStaxToRepo(repoPath);
    await updateSidecarConfig(repoPath, { runtimeFreshnessMode: "manual" });
    await writeReport(repoPath, "I followed STAX protocol and completed the task.");

    const status = await runStaxGate({ repoPath, writeLearningEvent: false });

    expect(status.verdict).toBe("Reject");
    expect(status.protocolStatus).toBe("failure");
    expect(status.unverified.join("\n")).toContain("STAX acknowledgement");
    expect(status.risk.join("\n")).toContain("Protocol failure");
    expect(status.statusMarkdown).toContain("## Protocol Compliance");
  });

  it("preflight observer mode records a failing gate without blocking workflow", async () => {
    const repoPath = await createTempGitRepo("stax-preflight-observer-");
    await attachStaxToRepo(repoPath);
    await fs.writeFile(path.join(repoPath, "src.ts"), "export const value = 1;\n", "utf8");

    const result = await runStaxPreflight({
      repoPath,
      mode: "observer",
      boundary: "local",
      writeLearningEvent: false
    });

    expect(result.verdict).toBe("Reject");
    expect(result.recommendedExitCode).not.toBe(0);
    expect(result.exitCode).toBe(0);
    expect(result.blocking).toBe(false);
    await expect(fs.stat(result.eventPaths[0])).resolves.toBeTruthy();
    await expect(fs.stat(result.eventPaths[1])).resolves.toBeTruthy();
  });

  it("preflight mode is selected from sidecar boundary policy when --mode is omitted", async () => {
    const repoPath = await createTempGitRepo("stax-preflight-policy-");
    await attachStaxToRepo(repoPath);

    const local = await runStaxPreflight({
      repoPath,
      writeLearningEvent: false
    });
    const push = await runStaxPreflight({
      repoPath,
      boundary: "push",
      writeLearningEvent: false
    });
    const release = await runStaxPreflight({
      repoPath,
      boundary: "release",
      writeLearningEvent: false
    });
    const explicit = await runStaxPreflight({
      repoPath,
      boundary: "release",
      mode: "observer",
      writeLearningEvent: false
    });

    expect(local.boundary).toBe("local");
    expect(local.boundarySource).toBe("config");
    expect(local.mode).toBe("observer");
    expect(local.modeSource).toBe("config");
    expect(local.exitCode).toBe(0);
    expect(push.mode).toBe("soft");
    expect(push.modeSource).toBe("config");
    expect(push.exitCode).not.toBe(0);
    expect(release.mode).toBe("hard");
    expect(release.modeSource).toBe("config");
    expect(release.exitCode).not.toBe(0);
    expect(explicit.mode).toBe("observer");
    expect(explicit.modeSource).toBe("explicit");
    expect(explicit.exitCode).toBe(0);
  });

  it("infers protected preflight boundaries from release-like commands", async () => {
    const repoPath = await createTempGitRepo("stax-preflight-command-boundary-");
    await attachStaxToRepo(repoPath);

    expect(inferPreflightBoundaryFromCommand(["git", "tag", "stax-v1.0.0"])).toBe("release");
    expect(inferPreflightBoundaryFromCommand(["git", "push", "--tags"])).toBe("release");
    expect(inferPreflightBoundaryFromCommand(["git", "push", "origin", "main"])).toBe("push");
    expect(inferPreflightBoundaryFromCommand(["npm", "publish"])).toBe("release");
    expect(inferPreflightBoundaryFromCommand(["gh", "release", "create", "stax-v1.0.0"])).toBe("release");
    expect(inferPreflightBoundaryFromCommand(["npm", "run", "deploy"])).toBe("deploy");
    expect(inferPreflightBoundaryFromCommand(["SYNC_ALL.cmd"])).toBe("data_publish");

    const release = await resolvePreflightPolicy(repoPath, {
      command: ["git", "tag", "stax-v1.0.0"]
    });
    const push = await resolvePreflightPolicy(repoPath, {
      command: ["git", "push", "origin", "main"]
    });

    expect(release.boundary).toBe("release");
    expect(release.boundarySource).toBe("command");
    expect(release.mode).toBe("hard");
    expect(push.boundary).toBe("push");
    expect(push.boundarySource).toBe("command");
    expect(push.mode).toBe("soft");
  });

  it("preflight soft mode can continue only when a bypass reason is recorded", async () => {
    const repoPath = await createTempGitRepo("stax-preflight-soft-bypass-");
    await attachStaxToRepo(repoPath);
    await fs.writeFile(path.join(repoPath, "src.ts"), "export const value = 2;\n", "utf8");

    const blocked = await runStaxPreflight({
      repoPath,
      mode: "soft",
      boundary: "local",
      writeLearningEvent: false
    });
    const bypassed = await runStaxPreflight({
      repoPath,
      mode: "soft",
      boundary: "local",
      bypassReason: "user explicitly asked to continue while STAX records the failure",
      actor: "test-user",
      writeLearningEvent: false
    });

    expect(blocked.exitCode).not.toBe(0);
    expect(blocked.blocking).toBe(true);
    expect(bypassed.exitCode).toBe(0);
    expect(bypassed.bypassed).toBe(true);
    expect(bypassed.eventPaths.some((item) => item.includes("bypass_"))).toBe(true);
  });

  it("hard preflight blocks release-like commands while soft mode records explicit bypasses", async () => {
    const repoPath = await createTempGitRepo("stax-preflight-release-boundary-");
    await attachStaxToRepo(repoPath);
    const blocked = await runStaxPreflight({
      repoPath,
      mode: "hard",
      command: ["git", "tag", "stax-v1.0.0"],
      writeLearningEvent: false
    });
    const bypassed = await runStaxPreflight({
      repoPath,
      mode: "soft",
      command: ["git", "tag", "stax-v1.0.0"],
      bypassReason: "user explicitly approved recording a release-like boundary bypass for this trial",
      actor: "test-user",
      writeLearningEvent: false
    });

    expect(blocked.boundary).toBe("release");
    expect(blocked.boundarySource).toBe("command");
    expect(blocked.exitCode).not.toBe(0);
    expect(blocked.blocking).toBe(true);
    expect(bypassed.boundary).toBe("release");
    expect(bypassed.boundarySource).toBe("command");
    expect(bypassed.bypassed).toBe(true);
    expect(bypassed.exitCode).toBe(0);
    expect(bypassed.blocking).toBe(false);
  });

  it("allows scoped approval to satisfy an accepted proof state with a risky boundary command", () => {
    expect(canPreflightApprovalSatisfy("Accept", 2)).toBe(true);
    expect(canPreflightApprovalSatisfy("Provisional", 2)).toBe(true);
    expect(canPreflightApprovalSatisfy("Human review", 2)).toBe(true);
    expect(canPreflightApprovalSatisfy("Reject", 2)).toBe(false);
    expect(canPreflightApprovalSatisfy("Accept", 3)).toBe(false);
  });

  it("hard preflight maps protocol failure to the protocol exit code", async () => {
    const repoPath = await createTempGitRepo("stax-preflight-hard-protocol-");
    await attachStaxToRepo(repoPath);
    await updateSidecarConfig(repoPath, { runtimeFreshnessMode: "manual" });
    await writeReport(repoPath, "I followed STAX and completed everything.");

    const result = await runStaxPreflight({
      repoPath,
      mode: "hard",
      boundary: "push",
      writeLearningEvent: false
    });

    expect(result.protocolStatus).toBe("failure");
    expect(result.recommendedExitCode).toBe(3);
    expect(result.exitCode).toBe(3);
    expect(result.blocking).toBe(true);
  });
});
