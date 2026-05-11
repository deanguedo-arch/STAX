import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  STAX_AGENTS_SECTION_END_MARKER,
  STAX_AGENTS_SECTION_MARKER
} from "../src/sidecar/AttachStax.js";
import { upgradeStaxSidecar, STAX_SIDECAR_PROTOCOL_VERSION } from "../src/sidecar/UpgradeSidecar.js";
import { createTempGitRepo } from "./sidecarTestHelpers.js";

describe("STAX sidecar upgrade", () => {
  it("refreshes generated protocol surfaces while preserving repo evidence", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-upgrade-");
    await seedStaleSidecar(repoPath);

    const result = await upgradeStaxSidecar({ repoPath });

    const protocol = await fs.readFile(path.join(repoPath, ".stax", "AGENT_PROTOCOL.md"), "utf8");
    const agents = await fs.readFile(path.join(repoPath, "AGENTS.md"), "utf8");
    const config = JSON.parse(await fs.readFile(path.join(repoPath, ".stax", "config.json"), "utf8")) as {
      sidecarProtocolVersion?: string;
      requireFreshCodexTurnCapture?: boolean;
      runtimeFreshnessMode?: string;
    };
    const task = await fs.readFile(path.join(repoPath, ".stax", "task.md"), "utf8");
    const report = await fs.readFile(path.join(repoPath, ".stax", "codex-report.md"), "utf8");
    const ledger = await fs.readFile(path.join(repoPath, ".stax", "ledger.json"), "utf8");
    const event = await fs.readFile(path.join(repoPath, ".stax", "events", "evt-1.json"), "utf8");
    const gitignore = await fs.readFile(path.join(repoPath, ".gitignore"), "utf8");

    expect(result.targetProtocolVersion).toBe(STAX_SIDECAR_PROTOCOL_VERSION);
    expect(result.changedFiles).toEqual(
      expect.arrayContaining([
        path.join(repoPath, ".stax", "AGENT_PROTOCOL.md"),
        path.join(repoPath, ".stax", "config.json"),
        path.join(repoPath, ".stax", "reports", "latest-proof-report.md"),
        path.join(repoPath, ".gitignore"),
        path.join(repoPath, "AGENTS.md")
      ])
    );
    expect(result.preservedFiles).toEqual(
      expect.arrayContaining([
        path.join(repoPath, ".stax", "task.md"),
        path.join(repoPath, ".stax", "codex-report.md"),
        path.join(repoPath, ".stax", "ledger.json")
      ])
    );
    expect(protocol).toContain("Do not claim completion without proof.");
    expect(protocol).not.toContain("stale sidecar protocol");
    expect(agents).toContain("Keep repo instructions.");
    expect(agents).toContain("read `.stax/next-codex-prompt.md`");
    expect(agents).not.toContain("old stale STAX section");
    expect(agents.match(new RegExp(STAX_AGENTS_SECTION_MARKER, "g"))?.length).toBe(1);
    expect(agents.match(new RegExp(STAX_AGENTS_SECTION_END_MARKER, "g"))?.length).toBe(1);
    expect(config.sidecarProtocolVersion).toBe(STAX_SIDECAR_PROTOCOL_VERSION);
    expect(config.requireFreshCodexTurnCapture).toBe(true);
    expect(config.runtimeFreshnessMode).toBe("strict");
    expect(task).toBe("do not overwrite task\n");
    expect(report).toBe("do not overwrite report\n");
    expect(ledger).toContain("do-not-overwrite");
    expect(event).toContain("evidence");
    expect(gitignore).toContain(".stax/*");
    expect(gitignore).toContain("!.stax/proof_strength.json");
    expect(gitignore).toContain("!.stax/reports/latest-proof-report.md");
    await expect(fs.stat(path.join(repoPath, ".stax", "reports", "latest-proof-report.md"))).resolves.toBeTruthy();
  });

  it("is idempotent after the sidecar is current", async () => {
    const repoPath = await createTempGitRepo("stax-sidecar-upgrade-idempotent-");

    const first = await upgradeStaxSidecar({ repoPath });
    const second = await upgradeStaxSidecar({ repoPath });

    expect(first.changedFiles.length).toBeGreaterThan(0);
    expect(second.changedFiles).toEqual([]);
    await expect(fs.stat(path.join(repoPath, ".stax", "runtime"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "turns"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(repoPath, ".stax", "reports", "latest-proof-report.md"))).resolves.toBeTruthy();
  });
});

async function seedStaleSidecar(repoPath: string): Promise<void> {
  const staxPath = path.join(repoPath, ".stax");
  await fs.mkdir(path.join(staxPath, "events"), { recursive: true });
  await fs.writeFile(path.join(repoPath, "AGENTS.md"), staleAgents(), "utf8");
  await fs.writeFile(path.join(repoPath, ".gitignore"), "node_modules/\n", "utf8");
  await fs.writeFile(
    path.join(staxPath, "config.json"),
    `${JSON.stringify(
      {
        schemaVersion: "stax-sidecar-config-v1",
        repoName: "old-name",
        requireFreshCodexTurnCapture: true,
        runtimeFreshnessMode: "strict"
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await fs.writeFile(path.join(staxPath, "AGENT_PROTOCOL.md"), "stale sidecar protocol\n", "utf8");
  await fs.writeFile(path.join(staxPath, "task.md"), "do not overwrite task\n", "utf8");
  await fs.writeFile(path.join(staxPath, "codex-report.md"), "do not overwrite report\n", "utf8");
  await fs.writeFile(path.join(staxPath, "ledger.json"), "{\"tasks\":[\"do-not-overwrite\"]}\n", "utf8");
  await fs.writeFile(path.join(staxPath, "events", "evt-1.json"), "{\"kind\":\"evidence\"}\n", "utf8");
}

function staleAgents(): string {
  return [
    "# Existing",
    "",
    "Keep repo instructions.",
    "",
    STAX_AGENTS_SECTION_MARKER,
    "old stale STAX section",
    STAX_AGENTS_SECTION_END_MARKER,
    ""
  ].join("\n");
}
