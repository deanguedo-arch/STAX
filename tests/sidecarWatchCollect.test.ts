import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { attachStaxToRepo } from "../src/sidecar/AttachStax.js";
import {
  collectCodexTurn,
  writeSidecarHeartbeat
} from "../src/sidecar/CodexTurnCapture.js";
import {
  collectCommandEvidence,
  isDangerousSidecarCommand
} from "../src/sidecar/CommandEvidenceCollector.js";
import { externalCommandEvidenceStoreForRepo } from "../src/sidecar/ExternalCommandEvidenceStore.js";
import { runStaxGate } from "../src/sidecar/StaxGate.js";
import { StaxWatcher } from "../src/sidecar/StaxWatcher.js";
import { commitFile, createTempGitRepo } from "./sidecarTestHelpers.js";

async function updateSidecarConfig(repoPath: string, patch: Record<string, unknown>): Promise<void> {
  const configPath = path.join(repoPath, ".stax", "config.json");
  const config = JSON.parse(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
  await fs.writeFile(configPath, `${JSON.stringify({ ...config, ...patch }, null, 2)}\n`, "utf8");
}

async function writeProofClaimReport(repoPath: string, evidenceId = "cmd") {
  await fs.writeFile(
    path.join(repoPath, ".stax", "codex-report.md"),
    [
      "Objective: verify command proof.",
      "Files changed: src/app.ts",
      "Tests added: none",
      "Commands run: npm test",
      `Command output summary with exit codes: ${evidenceId} exit code 0`,
      "What is verified: implementation complete and tests passed.",
      "What is weak/provisional: none.",
      "What is unverified: none.",
      "Risks: none.",
      "One next action: accept.",
      ""
    ].join("\n"),
    "utf8"
  );
}

async function prepareCommandProofRepo(prefix: string): Promise<string> {
  const repoPath = await createTempGitRepo(prefix);
  useTestExternalEvidenceRoot(repoPath);
  await attachStaxToRepo(repoPath);
  await updateSidecarConfig(repoPath, {
    runtimeFreshnessMode: "manual",
    turnComplianceMode: "manual"
  });
  await commitFile(
    repoPath,
    "package.json",
    `${JSON.stringify({ scripts: { test: "node -e \"console.log('tests passed')\"" } }, null, 2)}\n`
  );
  await commitFile(repoPath, "src/app.ts", "export const value = 1;\n");
  return repoPath;
}

function useTestExternalEvidenceRoot(repoPath: string): string {
  const root = path.join(repoPath, "..", `${path.basename(repoPath)}-external-evidence`);
  process.env.STAX_EVIDENCE_ROOT = root;
  return root;
}

describe("STAX sidecar watch and collect", () => {
  afterEach(() => {
    delete process.env.STAX_EVIDENCE_ROOT;
  });

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
    await fs.writeFile(path.join(repoPath, ".stax", "proof_strength.json"), "{\"stale\":true}\n", "utf8");

    const status = await runStaxGate({
      repoPath,
      writeLearningEvent: false,
      now: new Date("2026-05-04T18:01:00.000Z")
    });

    expect(status.verdict).toBe("Accept");
    expect(status.verified.join("\n")).toContain("Fresh Codex turn capture is present");
    await expect(fs.stat(path.join(repoPath, ".stax", "proof_strength.json"))).rejects.toMatchObject({ code: "ENOENT" });
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
    useTestExternalEvidenceRoot(repoPath);
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
    expect(pass.worktreeBefore.fingerprintHash).toHaveLength(64);
    expect(pass.worktreeAfter.fingerprintHash).toHaveLength(64);
    expect(pass.stdoutHash).toHaveLength(64);
    expect(pass.stderrHash).toHaveLength(64);
    expect(pass.canonicalEvidenceHash).toHaveLength(64);
    expect(fail.exitCode).toBe(3);
    const store = externalCommandEvidenceStoreForRepo(repoPath);
    await expect(fs.stat(path.join(store.commandEvidenceDir, pass.stdoutPath))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(store.commandEvidenceDir, fail.stderrPath))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "command-evidence", `${pass.evidenceId}.pointer.json`))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "command-evidence", `${pass.evidenceId}.json`))).rejects.toMatchObject({ code: "ENOENT" });
    const ledger = await fs.readFile(pass.externalLedgerPath, "utf8");
    expect(ledger.trim().split(/\r?\n/)).toHaveLength(2);
  });

  it("rejects forged local command evidence JSON that is not in the ledger", async () => {
    const repoPath = await prepareCommandProofRepo("stax-sidecar-forged-json-");
    const evidenceId = "cmd_forged";
    await fs.writeFile(
      path.join(repoPath, ".stax", "command-evidence", `${evidenceId}.json`),
      `${JSON.stringify(
        {
          evidenceId,
          command: "npm test",
          cwd: repoPath,
          repo: path.basename(repoPath),
          exitCode: 0,
          stdout: "tests passed",
          stderr: "",
          startedAt: "2026-05-11T00:00:00.000Z",
          finishedAt: "2026-05-11T00:00:01.000Z",
          source: "local_stax_command_output"
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeProofClaimReport(repoPath, evidenceId);

    const status = await runStaxGate({ repoPath, writeLearningEvent: false });

    expect(status.verdict).toBe("Reject");
    expect(status.unverified.join("\n")).toContain("Command evidence provenance is not verified");
    expect(status.risk.join("\n")).toMatch(/ledger_unverified|missing_stream_hash|tampered_evidence/);
    expect(status.proofStrength?.capApplied.map((cap) => cap.id)).toContain("unverified_local_command_provenance");
  });

  it("rejects command evidence after a tracked source file changes without committing", async () => {
    const repoPath = await prepareCommandProofRepo("stax-sidecar-stale-tracked-");
    const evidence = await collectCommandEvidence({
      repoPath,
      command: ["npm", "test"],
      writeLearningEvent: false
    });
    await fs.writeFile(path.join(repoPath, "src/app.ts"), "export const value = 2;\n", "utf8");
    await writeProofClaimReport(repoPath, evidence.evidenceId);

    const status = await runStaxGate({ repoPath, writeLearningEvent: false });

    expect(status.verdict).toBe("Reject");
    expect(status.unverified.join("\n")).toContain("wrong_worktree");
    expect(status.risk.join("\n")).toContain("wrong_worktree");
  });

  it("rejects command evidence after an untracked relevant source file appears", async () => {
    const repoPath = await prepareCommandProofRepo("stax-sidecar-stale-untracked-");
    const evidence = await collectCommandEvidence({
      repoPath,
      command: ["npm", "test"],
      writeLearningEvent: false
    });
    await fs.writeFile(path.join(repoPath, "src/new.ts"), "export const newer = true;\n", "utf8");
    await writeProofClaimReport(repoPath, evidence.evidenceId);

    const status = await runStaxGate({ repoPath, writeLearningEvent: false });

    expect(status.verdict).toBe("Reject");
    expect(status.unverified.join("\n")).toContain("wrong_worktree");
  });

  it("rejects command evidence when stdout is edited after collection", async () => {
    const repoPath = await prepareCommandProofRepo("stax-sidecar-tampered-stdout-");
    const evidence = await collectCommandEvidence({
      repoPath,
      command: ["npm", "test"],
      writeLearningEvent: false
    });
    await fs.writeFile(path.join(path.dirname(evidence.externalEvidencePath), evidence.stdoutPath), "forged output\n", "utf8");
    await writeProofClaimReport(repoPath, evidence.evidenceId);

    const status = await runStaxGate({ repoPath, writeLearningEvent: false });

    expect(status.verdict).toBe("Reject");
    expect(status.unverified.join("\n")).toContain("tampered_evidence");
    expect(status.risk.join("\n")).toContain("tampered_evidence");
  });

  it("rejects command evidence when the evidence JSON is edited after collection", async () => {
    const repoPath = await prepareCommandProofRepo("stax-sidecar-tampered-json-");
    const evidence = await collectCommandEvidence({
      repoPath,
      command: ["npm", "test"],
      writeLearningEvent: false
    });
    const evidencePath = evidence.externalEvidencePath;
    const parsed = JSON.parse(await fs.readFile(evidencePath, "utf8")) as Record<string, unknown>;
    parsed.tampered = true;
    await fs.writeFile(evidencePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    await writeProofClaimReport(repoPath, evidence.evidenceId);

    const status = await runStaxGate({ repoPath, writeLearningEvent: false });

    expect(status.verdict).toBe("Reject");
    expect(status.unverified.join("\n")).toContain("tampered_evidence");
  });

  it("rejects command evidence when the ledger chain is edited after collection", async () => {
    const repoPath = await prepareCommandProofRepo("stax-sidecar-tampered-ledger-");
    const evidence = await collectCommandEvidence({
      repoPath,
      command: ["npm", "test"],
      writeLearningEvent: false
    });
    const ledgerPath = evidence.externalLedgerPath;
    const ledger = await fs.readFile(ledgerPath, "utf8");
    await fs.writeFile(ledgerPath, ledger.replace(evidence.evidenceId, `${evidence.evidenceId}_edited`), "utf8");
    await writeProofClaimReport(repoPath, evidence.evidenceId);

    const status = await runStaxGate({ repoPath, writeLearningEvent: false });

    expect(status.verdict).toBe("Reject");
    expect(status.unverified.join("\n")).toContain("Command evidence provenance is not verified");
    expect(status.risk.join("\n")).toMatch(/ledger_unverified|tampered_evidence|missing_stream_hash/);
  });

  it("blocks dangerous command collection unless allow-risky is explicit", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-risky-");
    useTestExternalEvidenceRoot(repoPath);
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
    useTestExternalEvidenceRoot(repoPath);
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
