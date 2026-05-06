import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { attachStaxToRepo, STAX_AGENT_PROTOCOL } from "../src/sidecar/AttachStax.js";
import { checkTurnCompliance } from "../src/sidecar/TurnCompliance.js";
import { readTurnContract, writeTurnContract } from "../src/sidecar/TurnContract.js";
import { writeSidecarHeartbeat } from "../src/sidecar/CodexTurnCapture.js";
import { runStaxGate } from "../src/sidecar/StaxGate.js";
import { createTempGitRepo } from "./sidecarTestHelpers.js";

async function writeReport(repoPath: string, text: string): Promise<void> {
  await fs.writeFile(path.join(repoPath, ".stax", "codex-report.md"), text, "utf8");
}

function compliantReport(ack: string): string {
  return [
    `STAX acknowledgement: ${ack}`,
    "Objective: Verify STAX turn compliance.",
    "Files changed: None.",
    "Tests added: None.",
    "Commands run: None.",
    "Command output summary with exit codes: No commands run.",
    "What is verified: STAX acknowledgement is present.",
    "What is weak/provisional: No implementation proof was requested.",
    "What is unverified: Nothing else verified.",
    "Risks: None.",
    "One next action: Continue.",
    ""
  ].join("\n");
}

async function writeCurrentTurn(repoPath: string, text: string): Promise<void> {
  await fs.writeFile(
    path.join(repoPath, ".stax", "current-turn.json"),
    `${JSON.stringify(
      {
        schemaVersion: "stax-codex-turn-v1",
        capturedAt: "2026-05-05T18:23:00.000Z",
        sessionId: "session-ack",
        source: {
          path: path.join(repoPath, "codex-sessions", "rollout-session.jsonl"),
          hash: "a".repeat(64),
          modifiedAt: "2026-05-05T18:23:00.000Z"
        },
        messageCount: 1,
        messages: [{ role: "assistant", text }]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

async function updateSidecarConfig(repoPath: string, patch: Record<string, unknown>): Promise<void> {
  const configPath = path.join(repoPath, ".stax", "config.json");
  const config = JSON.parse(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
  await fs.writeFile(configPath, `${JSON.stringify({ ...config, ...patch }, null, 2)}\n`, "utf8");
}

describe("STAX turn compliance", () => {
  it("writeTurnContract creates .stax/turn-contract.json", async () => {
    const repoPath = await createTempGitRepo("stax-turn-contract-write-");
    await attachStaxToRepo(repoPath);
    const contract = await writeTurnContract({
      repoPath,
      now: new Date("2026-05-05T18:22:10.000Z"),
      turnIdSuffix: "a91c"
    });
    const stored = await readTurnContract(repoPath);

    expect(stored?.turnId).toBe(contract.turnId);
    await expect(fs.stat(path.join(repoPath, ".stax", "turn-contract.json"))).resolves.toBeTruthy();
  });

  it("ACK format includes turnId, statusHash, and nextPromptHash", async () => {
    const repoPath = await createTempGitRepo("stax-turn-contract-ack-");
    await attachStaxToRepo(repoPath);
    const contract = await writeTurnContract({
      repoPath,
      now: new Date("2026-05-05T18:22:10.000Z"),
      turnIdSuffix: "a91c"
    });

    expect(contract.requiredAcknowledgement).toBe(
      `STAX_ACK ${contract.turnId} ${contract.statusHash} ${contract.nextPromptHash}`
    );
  });

  it("gate rejects in strict mode when ACK is missing", async () => {
    const repoPath = await createTempGitRepo("stax-turn-gate-missing-ack-");
    await attachStaxToRepo(repoPath);
    await updateSidecarConfig(repoPath, {
      runtimeFreshnessMode: "manual",
      turnComplianceMode: "strict"
    });

    const status = await runStaxGate({
      repoPath,
      writeLearningEvent: false,
      now: new Date("2026-05-05T18:23:00.000Z")
    });

    expect(status.verdict).toBe("Reject");
    expect(status.unverified.join("\n")).toContain("STAX acknowledgement");
  });

  it("gate ignores turn contract evidence in manual mode", async () => {
    const repoPath = await createTempGitRepo("stax-turn-gate-manual-");
    await attachStaxToRepo(repoPath);
    await updateSidecarConfig(repoPath, {
      runtimeFreshnessMode: "manual",
      turnComplianceMode: "manual"
    });

    const status = await runStaxGate({
      repoPath,
      writeLearningEvent: false,
      now: new Date("2026-05-05T18:23:00.000Z")
    });

    expect(status.verdict).toBe("Accept");
    expect(status.unverified.join("\n")).not.toContain("STAX acknowledgement");
  });

  it("gate passes compliance when codex-report and current turn contain the correct ACK", async () => {
    const repoPath = await createTempGitRepo("stax-turn-gate-pass-");
    await attachStaxToRepo(repoPath);
    const contract = await readTurnContract(repoPath);
    expect(contract).toBeTruthy();
    await writeReport(repoPath, compliantReport(contract?.requiredAcknowledgement ?? ""));
    await writeCurrentTurn(repoPath, `I read STAX. ${contract?.requiredAcknowledgement}`);
    await writeSidecarHeartbeat({
      repoPath,
      now: new Date("2026-05-05T18:23:00.000Z"),
      pid: 321
    });

    const status = await runStaxGate({
      repoPath,
      writeLearningEvent: false,
      now: new Date("2026-05-05T18:23:30.000Z")
    });

    expect(status.verdict).toBe("Accept");
    expect(status.verified.join("\n")).toContain("Codex acknowledged current STAX turn contract");
  });

  it("rejects stale ACK with an old turnId", async () => {
    const repoPath = await createTempGitRepo("stax-turn-stale-ack-");
    await attachStaxToRepo(repoPath);
    const contract = await readTurnContract(repoPath);
    await writeReport(repoPath, `STAX_ACK old_turn ${contract?.statusHash} ${contract?.nextPromptHash}`);

    const result = await checkTurnCompliance({ repoPath, mode: "strict" });

    expect(result.pass).toBe(false);
    expect(result.issues.map((issue) => issue.message).join("\n")).toContain("turnId");
  });

  it("rejects wrong statusHash", async () => {
    const repoPath = await createTempGitRepo("stax-turn-wrong-status-");
    await attachStaxToRepo(repoPath);
    const contract = await readTurnContract(repoPath);
    await writeReport(repoPath, `STAX_ACK ${contract?.turnId} deadbeef ${contract?.nextPromptHash}`);

    const result = await checkTurnCompliance({ repoPath, mode: "strict" });

    expect(result.pass).toBe(false);
    expect(result.issues.map((issue) => issue.message).join("\n")).toContain("statusHash");
  });

  it("rejects wrong nextPromptHash", async () => {
    const repoPath = await createTempGitRepo("stax-turn-wrong-prompt-");
    await attachStaxToRepo(repoPath);
    const contract = await readTurnContract(repoPath);
    await writeReport(repoPath, `STAX_ACK ${contract?.turnId} ${contract?.statusHash} deadbeef`);

    const result = await checkTurnCompliance({ repoPath, mode: "strict" });

    expect(result.pass).toBe(false);
    expect(result.issues.map((issue) => issue.message).join("\n")).toContain("nextPromptHash");
  });

  it("normal mode makes missing ACK provisional when no completion claim exists", async () => {
    const repoPath = await createTempGitRepo("stax-turn-normal-weak-");
    await attachStaxToRepo(repoPath);

    const result = await checkTurnCompliance({ repoPath, mode: "normal", codexClaimsCompletion: false });

    expect(result.pass).toBe(false);
    expect(result.severity).toBe("weak");
  });

  it("normal mode rejects missing ACK when Codex claims completion", async () => {
    const repoPath = await createTempGitRepo("stax-turn-normal-reject-");
    await attachStaxToRepo(repoPath);

    const result = await checkTurnCompliance({ repoPath, mode: "normal", codexClaimsCompletion: true });

    expect(result.pass).toBe(false);
    expect(result.severity).toBe("reject");
  });

  it("normal mode rejects missing ACK when a diff exists", async () => {
    const repoPath = await createTempGitRepo("stax-turn-normal-diff-reject-");
    await attachStaxToRepo(repoPath);

    const result = await checkTurnCompliance({ repoPath, mode: "normal", hasDiff: true });

    expect(result.pass).toBe(false);
    expect(result.severity).toBe("reject");
  });

  it("current Codex turn capture containing ACK is recognized", async () => {
    const repoPath = await createTempGitRepo("stax-turn-current-pass-");
    await attachStaxToRepo(repoPath);
    const contract = await readTurnContract(repoPath);
    await writeReport(repoPath, `${contract?.requiredAcknowledgement}\n`);
    await writeCurrentTurn(repoPath, `Captured acknowledgement ${contract?.requiredAcknowledgement}`);

    const result = await checkTurnCompliance({ repoPath, mode: "strict" });

    expect(result.pass).toBe(true);
  });

  it("current Codex turn capture missing ACK is surfaced", async () => {
    const repoPath = await createTempGitRepo("stax-turn-current-missing-");
    await attachStaxToRepo(repoPath);
    const contract = await readTurnContract(repoPath);
    await writeReport(repoPath, `${contract?.requiredAcknowledgement}\n`);
    await writeCurrentTurn(repoPath, "Captured turn without acknowledgement");

    const result = await checkTurnCompliance({ repoPath, mode: "strict" });

    expect(result.pass).toBe(false);
    expect(result.issues.map((issue) => issue.message).join("\n")).toContain("Current Codex turn capture");
  });

  it("Attach protocol includes STAX acknowledgement requirement", () => {
    expect(STAX_AGENT_PROTOCOL).toContain("STAX_ACK");
    expect(STAX_AGENT_PROTOCOL).toContain("STAX acknowledgement");
    expect(STAX_AGENT_PROTOCOL).toContain(".stax/turn-contract.json");
  });
});
