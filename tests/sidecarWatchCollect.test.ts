import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { attachStaxToRepo } from "../src/sidecar/AttachStax.js";
import {
  collectCodexTurn,
  writeSidecarHeartbeat
} from "../src/sidecar/CodexTurnCapture.js";
import {
  collectCommandEvidence,
  isDangerousSidecarCommand
} from "../src/sidecar/CommandEvidenceCollector.js";
import { runStaxGate } from "../src/sidecar/StaxGate.js";
import { StaxWatcher } from "../src/sidecar/StaxWatcher.js";
import { commitFile, createTempGitRepo } from "./sidecarTestHelpers.js";

async function updateSidecarConfig(repoPath: string, patch: Record<string, unknown>): Promise<void> {
  const configPath = path.join(repoPath, ".stax", "config.json");
  const config = JSON.parse(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
  await fs.writeFile(configPath, `${JSON.stringify({ ...config, ...patch }, null, 2)}\n`, "utf8");
}

describe("STAX sidecar watch and collect", () => {
  it("collects Codex session content into current-turn and turn artifacts", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-codex-turn-");
    await attachStaxToRepo(repoPath);
    const sessionsRoot = path.join(repoPath, "codex-sessions");
    const sessionPath = path.join(sessionsRoot, "rollout-session.jsonl");
    await fs.mkdir(sessionsRoot, { recursive: true });
    await fs.writeFile(
      sessionPath,
      [
        JSON.stringify({ type: "session_meta", payload: { id: "session-123" } }),
        JSON.stringify({
          type: "response_item",
          payload: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "Run STAX sidecar." }]
          }
        }),
        JSON.stringify({
          type: "response_item",
          payload: {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "Starting sidecar." }]
          }
        })
      ].join("\n"),
      "utf8"
    );

    const result = await collectCodexTurn({
      repoPath,
      sessionsRoot,
      now: new Date("2026-05-04T18:00:00.000Z")
    });
    const currentTurn = JSON.parse(
      await fs.readFile(path.join(repoPath, ".stax", "current-turn.json"), "utf8")
    ) as { sessionId: string; messages: Array<{ role: string; text: string }>; source: { hash: string } };

    expect(result.messageCount).toBe(2);
    expect(currentTurn.sessionId).toBe("session-123");
    expect(currentTurn.source.hash).toHaveLength(64);
    expect(currentTurn.messages).toEqual([
      { role: "user", text: "Run STAX sidecar." },
      { role: "assistant", text: "Starting sidecar." }
    ]);
    await expect(fs.stat(result.turnArtifactPath)).resolves.toBeTruthy();
  });

  it("accepts a clean attached repo only after fresh heartbeat and Codex turn capture", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-fresh-turn-");
    await attachStaxToRepo(repoPath);
    const contract = JSON.parse(
      await fs.readFile(path.join(repoPath, ".stax", "turn-contract.json"), "utf8")
    ) as { requiredAcknowledgement: string };
    await fs.writeFile(
      path.join(repoPath, ".stax", "codex-report.md"),
      [
        `STAX acknowledgement: ${contract.requiredAcknowledgement}`,
        "Objective: Verify clean sidecar.",
        "Files changed: None.",
        "Tests added: None.",
        "Commands run: None.",
        "Command output summary with exit codes: No commands run.",
        "What is verified: STAX acknowledgement and fresh turn capture are present.",
        "What is weak/provisional: No implementation proof was requested.",
        "What is unverified: Nothing else verified.",
        "Risks: None.",
        "One next action: Continue.",
        ""
      ].join("\n"),
      "utf8"
    );
    await writeSidecarHeartbeat({
      repoPath,
      now: new Date("2026-05-04T18:00:00.000Z"),
      pid: 123
    });
    await fs.writeFile(
      path.join(repoPath, ".stax", "current-turn.json"),
      JSON.stringify(
        {
          schemaVersion: "stax-codex-turn-v1",
          capturedAt: "2026-05-04T18:00:00.000Z",
          sessionId: "session-123",
          source: {
            path: path.join(repoPath, "codex-sessions", "rollout-session.jsonl"),
            hash: "a".repeat(64),
            modifiedAt: "2026-05-04T18:00:00.000Z"
          },
          messageCount: 1,
          messages: [{ role: "assistant", text: `Run STAX sidecar. ${contract.requiredAcknowledgement}` }]
        },
        null,
        2
      ),
      "utf8"
    );

    const status = await runStaxGate({
      repoPath,
      writeLearningEvent: false,
      now: new Date("2026-05-04T18:01:00.000Z")
    });

    expect(status.verdict).toBe("Accept");
    expect(status.verified.join("\n")).toContain("Fresh Codex turn capture is present");
  });

  it("rejects stale heartbeat and Codex turn capture", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-stale-turn-");
    await attachStaxToRepo(repoPath);
    await updateSidecarConfig(repoPath, {
      runtimeFreshnessMode: "strict",
      turnComplianceMode: "manual"
    });
    await writeSidecarHeartbeat({
      repoPath,
      now: new Date("2026-05-04T17:00:00.000Z"),
      pid: 123
    });
    await fs.writeFile(
      path.join(repoPath, ".stax", "current-turn.json"),
      JSON.stringify(
        {
          schemaVersion: "stax-codex-turn-v1",
          capturedAt: "2026-05-04T17:00:00.000Z",
          sessionId: "session-123",
          source: {
            path: path.join(repoPath, "codex-sessions", "rollout-session.jsonl"),
            hash: "a".repeat(64),
            modifiedAt: "2026-05-04T17:00:00.000Z"
          },
          messageCount: 1,
          messages: [{ role: "user", text: "Old prompt." }]
        },
        null,
        2
      ),
      "utf8"
    );

    const status = await runStaxGate({
      repoPath,
      writeLearningEvent: false,
      now: new Date("2026-05-04T18:00:00.000Z")
    });

    expect(status.verdict).toBe("Reject");
    expect(status.unverified.join("\n")).toContain("STAX sidecar heartbeat is stale");
    expect(status.unverified.join("\n")).toContain("Codex turn capture is stale");
  });

  it("collects successful and failed command evidence", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-collect-");
    await attachStaxToRepo(repoPath);

    const pass = await collectCommandEvidence({
      repoPath,
      command: ["node", "-e", "console.log('ok')"],
      writeLearningEvent: false
    });
    const fail = await collectCommandEvidence({
      repoPath,
      command: ["node", "-e", "process.exit(3)"],
      writeLearningEvent: false
    });

    expect(pass.exitCode).toBe(0);
    expect(fail.exitCode).toBe(3);
    await expect(fs.stat(path.join(repoPath, ".stax", "command-evidence", pass.stdoutPath))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "command-evidence", fail.stderrPath))).resolves.toBeTruthy();
  });

  it("blocks dangerous command collection unless allow-risky is explicit", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-risky-");
    await attachStaxToRepo(repoPath);

    expect(isDangerousSidecarCommand(["git", "push"])).toBe(true);
    await expect(
      collectCommandEvidence({
        repoPath,
        command: ["git", "push"],
        writeLearningEvent: false
      })
    ).rejects.toThrow(/Dangerous command blocked/);

    const allowed = await collectCommandEvidence({
      repoPath,
      command: ["node", "-e", "console.log('deploy')"],
      allowRisky: true,
      writeLearningEvent: false
    });

    expect(allowed.exitCode).toBe(0);
    expect(allowed.warning).toMatch(/allow-risky/);
  });

  it("audits only changed inputs and reports verdict changes", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-watch-");
    await attachStaxToRepo(repoPath);
    const verdicts: string[] = [];
    const watcher = new StaxWatcher({
      repoPath,
      onVerdictChange(status) {
        verdicts.push(status.verdict);
      }
    });

    const first = await watcher.scanOnce();
    const second = await watcher.scanOnce();
    await fs.writeFile(path.join(repoPath, ".stax", "codex-report.md"), "Objective: inspect\n", "utf8");
    const third = await watcher.scanOnce();

    expect(first.audited).toBe(true);
    expect(second.audited).toBe(false);
    expect(third.audited).toBe(true);
    expect(verdicts.length).toBeGreaterThanOrEqual(1);
  });

  it("uses latest rerun evidence instead of permanently blocking on an older failure", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-rerun-");
    await attachStaxToRepo(repoPath);
    await commitFile(repoPath, "check.js", "process.exit(2);\n");
    await collectCommandEvidence({
      repoPath,
      command: ["node", "check.js"],
      writeLearningEvent: false
    });
    await fs.writeFile(path.join(repoPath, "check.js"), "process.exit(0);\n", "utf8");
    await collectCommandEvidence({
      repoPath,
      command: ["node", "check.js"],
      writeLearningEvent: false
    });

    const status = await runStaxGate({ repoPath, writeLearningEvent: false });

    expect(status.why).not.toContain("failed_proof");
    expect(status.unverified.join("\n")).not.toContain("Command evidence failed");
    expect(status.weak.join("\n")).toContain("superseded by a later passing");
  });
});
