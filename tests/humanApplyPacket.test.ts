import { describe, expect, it } from "vitest";
import { HumanApplyPacketBuilder } from "../src/execution/HumanApplyPacket.js";

const changedFile = {
  filePath: "package-lock.json",
  beforeHash: "a".repeat(64),
  afterHash: "b".repeat(64),
  beforeSizeBytes: 10,
  afterSizeBytes: 12,
  created: false
};

const commandResult = {
  command: "npm run build",
  status: "passed" as const,
  exitCode: 0,
  evidenceId: "cmd-ev-build",
  summary: "build passed"
};

describe("HumanApplyPacketBuilder", () => {
  it("recommends do_not_apply for failed sandboxes", () => {
    const packet = new HumanApplyPacketBuilder().build({
      status: "sandbox_failed",
      packetId: "repair_rollup_install_integrity",
      sandboxPath: "/tmp/sandbox",
      linkedRepoPath: "/repo/brightspace",
      changedFiles: [changedFile],
      patchDiffPath: "evidence/patches/diff.txt",
      commandResults: [{ ...commandResult, status: "failed", exitCode: 1 }],
      commandEvidenceIds: ["cmd-ev-build"],
      firstRemainingFailure: "npm run build failed"
    });

    expect(packet.recommendation).toBe("do_not_apply");
    expect(packet.appliedToRealRepo).toBe(false);
    expect(packet.requiresHumanApproval).toBe(true);
  });

  it("recommends do_not_apply for forbidden diffs", () => {
    const packet = new HumanApplyPacketBuilder().build({
      status: "sandbox_verified",
      packetId: "repair_rollup_install_integrity",
      sandboxPath: "/tmp/sandbox",
      linkedRepoPath: "/repo/brightspace",
      changedFiles: [changedFile],
      patchDiffPath: "evidence/patches/diff.txt",
      commandResults: [commandResult],
      commandEvidenceIds: ["cmd-ev-build"],
      forbiddenDiff: true
    });

    expect(packet.recommendation).toBe("do_not_apply");
    expect(packet.markdown).toContain("Diff touched a forbidden file boundary");
  });

  it("recommends apply for verified sandbox patches but never applies them", () => {
    const packet = new HumanApplyPacketBuilder().build({
      status: "sandbox_verified",
      packetId: "repair_rollup_install_integrity",
      sandboxPath: "/tmp/sandbox",
      linkedRepoPath: "/repo/brightspace",
      changedFiles: [changedFile],
      patchDiffPath: "evidence/patches/diff.txt",
      patchEvidenceId: "patch-ev-1",
      commandResults: [commandResult],
      commandEvidenceIds: ["cmd-ev-build"]
    });

    expect(packet.recommendation).toBe("apply");
    expect(packet.appliedToRealRepo).toBe(false);
    expect(packet.markdown).toContain("Approve applying this sandbox diff");
  });

  it("returns needs_review when command evidence is missing", () => {
    const packet = new HumanApplyPacketBuilder().build({
      status: "sandbox_verified",
      packetId: "repair_rollup_install_integrity",
      sandboxPath: "/tmp/sandbox",
      linkedRepoPath: "/repo/brightspace",
      changedFiles: [changedFile],
      patchDiffPath: "evidence/patches/diff.txt",
      commandResults: [],
      commandEvidenceIds: [],
      missingCommandEvidence: true
    });

    expect(packet.recommendation).toBe("needs_review");
    expect(packet.markdown).toContain("Command proof is missing or incomplete");
  });
});
