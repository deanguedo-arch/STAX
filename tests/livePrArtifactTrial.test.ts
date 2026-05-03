import { describe, expect, it } from "vitest";
import {
  runLivePrArtifactTrial,
  type LivePrArtifactTrialCaseResult
} from "../src/campaign/LivePrArtifactTrial.js";
import { loadPrArtifactTrialFixture } from "../src/campaign/PrArtifactTrial.js";

function renderProjectControlCard(status: string, includeCiLine = true): string {
  const ciLine = includeCiLine ? "- PR CI demo-workflow: ci_proof." : "- CI details omitted.";
  return [
    "## Verdict",
    `- Status: ${status}`,
    "- Why: Evidence remains bounded.",
    "",
    "## Verified",
    "- Packet present.",
    "",
    "## Weak / Provisional",
    "- Some proof is partial.",
    "",
    "## Unverified",
    ciLine,
    "",
    "## Risk",
    "- Risk exists.",
    "",
    "## One Next Action",
    "- Run the smallest relevant command and attach output.",
    "",
    "## Codex Prompt if needed",
    "```txt",
    "Return evidence only.",
    "```"
  ].join("\n");
}

describe("Live PR artifact trial", () => {
  it("passes when live packets are fetched and outputs are aligned", async () => {
    const fixture = await loadPrArtifactTrialFixture();
    const snapshots = new Map(
      fixture.snapshots.map((snapshot) => [`${snapshot.repoFullName}#${snapshot.packet.prNumber}`, snapshot.packet])
    );

    const summary = await runLivePrArtifactTrial({
      requestedCaseCount: 3,
      minimumLiveSourceCount: 3,
      allowFallbackSource: false,
      fetchPacket: async (ref) => {
        const packet = snapshots.get(`${ref.repoFullName}#${ref.prNumber}`);
        if (!packet) throw new Error("missing packet");
        return { source: "live_github_api", packet, warnings: [] };
      },
      runAudit: async ({ testCase }) => renderProjectControlCard(testCase.expectedStatus)
    });

    expect(summary.status).toBe("passed");
    expect(summary.liveSourceCount).toBe(3);
    expect(summary.fallbackSourceCount).toBe(0);
    expect(summary.falseAccepts).toBe(0);
    expect(summary.falseBlocks).toBe(0);
    expect(summary.usefulNextActionRate).toBe(100);
    expect(summary.ciProofClassificationSurfaceRate).toBe(100);
  });

  it("fails when outputs produce false accepts", async () => {
    const fixture = await loadPrArtifactTrialFixture();
    const snapshots = new Map(
      fixture.snapshots.map((snapshot) => [`${snapshot.repoFullName}#${snapshot.packet.prNumber}`, snapshot.packet])
    );

    const summary = await runLivePrArtifactTrial({
      requestedCaseCount: 2,
      minimumLiveSourceCount: 2,
      fetchPacket: async (ref) => {
        const packet = snapshots.get(`${ref.repoFullName}#${ref.prNumber}`);
        if (!packet) throw new Error("missing packet");
        return { source: "live_github_api", packet, warnings: [] };
      },
      runAudit: async () => renderProjectControlCard("Accept")
    });

    expect(summary.status).toBe("failed");
    expect(summary.falseAccepts).toBeGreaterThan(0);
    expect(summary.blockers).toContain("false accepts were recorded during the live PR trial");
  });

  it("fails when fallback sources are used while disallowed", async () => {
    const fixture = await loadPrArtifactTrialFixture();
    const snapshots = new Map(
      fixture.snapshots.map((snapshot) => [`${snapshot.repoFullName}#${snapshot.packet.prNumber}`, snapshot.packet])
    );

    const summary = await runLivePrArtifactTrial({
      requestedCaseCount: 2,
      minimumLiveSourceCount: 1,
      allowFallbackSource: false,
      fetchPacket: async (ref) => {
        const packet = snapshots.get(`${ref.repoFullName}#${ref.prNumber}`);
        if (!packet) throw new Error("missing packet");
        return { source: "recorded_snapshot_fallback", packet, warnings: ["fallback"] };
      },
      runAudit: async ({ testCase }) => renderProjectControlCard(testCase.expectedStatus)
    });

    expect(summary.status).toBe("failed");
    expect(summary.fallbackSourceCount).toBe(2);
    expect(summary.blockers).toContain("fallback snapshot source used in 2 case(s)");
  });

  it("tracks per-case issues when CI proof lines are missing", async () => {
    const fixture = await loadPrArtifactTrialFixture();
    const snapshots = new Map(
      fixture.snapshots.map((snapshot) => [`${snapshot.repoFullName}#${snapshot.packet.prNumber}`, snapshot.packet])
    );

    const summary = await runLivePrArtifactTrial({
      requestedCaseCount: 1,
      minimumLiveSourceCount: 1,
      allowFallbackSource: false,
      fetchPacket: async (ref) => {
        const packet = snapshots.get(`${ref.repoFullName}#${ref.prNumber}`);
        if (!packet) throw new Error("missing packet");
        return { source: "live_github_api", packet, warnings: [] };
      },
      runAudit: async ({ testCase }) => renderProjectControlCard(testCase.expectedStatus, false)
    });

    expect(summary.status).toBe("failed");
    expect(summary.ciProofClassificationSurfaceRate).toBe(0);
    const firstCase: LivePrArtifactTrialCaseResult | undefined = summary.cases[0];
    expect(firstCase?.issues).toContain("CI proof-strength line not surfaced in output");
  });

  it("surfaces retry timing when live coverage fails due rate limits", async () => {
    const fixture = await loadPrArtifactTrialFixture();
    const snapshots = new Map(
      fixture.snapshots.map((snapshot) => [`${snapshot.repoFullName}#${snapshot.packet.prNumber}`, snapshot.packet])
    );

    const summary = await runLivePrArtifactTrial({
      requestedCaseCount: 2,
      minimumLiveSourceCount: 1,
      allowFallbackSource: true,
      fetchPacket: async (ref) => {
        const packet = snapshots.get(`${ref.repoFullName}#${ref.prNumber}`);
        if (!packet) throw new Error("missing packet");
        return {
          source: "recorded_snapshot_fallback",
          packet,
          warnings: [
            "GitHub API request failed: 403 Forbidden; rate limit exceeded (resource=core, reset_at=2026-05-04T00:30:00.000Z)"
          ]
        };
      },
      runAudit: async ({ testCase }) => renderProjectControlCard(testCase.expectedStatus)
    });

    expect(summary.status).toBe("failed");
    expect(summary.blockers).toContain("live-source coverage too low: 0/2 (minimum 1)");
    expect(summary.blockers).toContain("live GitHub API likely rate limited; retry after 2026-05-04T00:30:00.000Z");
  });
});
