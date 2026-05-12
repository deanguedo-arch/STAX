import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validatePreflightApproval } from "../src/sidecar/PreflightEvents.js";
import { createPreflightApprovalTemplate } from "../src/sidecar/StaxPreflight.js";
import { collectWorktreeFingerprint } from "../src/sidecar/WorktreeFingerprint.js";
import { createTempGitRepo } from "./sidecarTestHelpers.js";

describe("preflight approval artifacts", () => {
  it("accepts only scoped, current, matching approval records", async () => {
    const repoPath = await createTempGitRepo("stax-preflight-approval-");
    const fingerprint = await collectWorktreeFingerprint(repoPath);
    const approvalPath = path.join(repoPath, "approval.json");
    await fs.writeFile(
      approvalPath,
      createPreflightApprovalTemplate({
        repoPath,
        boundary: "commit",
        fingerprint,
        approvedBy: "test-reviewer",
        reason: "Scoped approval for this exact worktree."
      }),
      "utf8"
    );

    const valid = await validatePreflightApproval({
      repoPath,
      approvalPath,
      boundary: "commit",
      worktreeFingerprintHash: fingerprint.fingerprintHash
    });
    const wrongBoundary = await validatePreflightApproval({
      repoPath,
      approvalPath,
      boundary: "push",
      worktreeFingerprintHash: fingerprint.fingerprintHash
    });

    expect(valid.valid).toBe(true);
    expect(wrongBoundary.valid).toBe(false);
    expect(wrongBoundary.reason).toContain("boundary");
  });

  it("rejects expired and wrong-worktree approval records", async () => {
    const repoPath = await createTempGitRepo("stax-preflight-approval-expired-");
    const fingerprint = await collectWorktreeFingerprint(repoPath);
    const approvalPath = path.join(repoPath, "approval.json");
    const expired = JSON.parse(createPreflightApprovalTemplate({
      repoPath,
      boundary: "commit",
      fingerprint,
      approvedBy: "test-reviewer",
      reason: "Expired approval.",
      now: new Date("2026-05-12T00:00:00.000Z")
    }));
    expired.expiresAt = "2026-05-12T00:00:01.000Z";
    await fs.writeFile(approvalPath, `${JSON.stringify(expired, null, 2)}\n`, "utf8");

    const expiredResult = await validatePreflightApproval({
      repoPath,
      approvalPath,
      boundary: "commit",
      worktreeFingerprintHash: fingerprint.fingerprintHash,
      now: new Date("2026-05-12T00:00:02.000Z")
    });

    expired.expiresAt = "2026-05-13T00:00:00.000Z";
    expired.worktreeFingerprintHash = "not-current";
    await fs.writeFile(approvalPath, `${JSON.stringify(expired, null, 2)}\n`, "utf8");
    const wrongWorktree = await validatePreflightApproval({
      repoPath,
      approvalPath,
      boundary: "commit",
      worktreeFingerprintHash: fingerprint.fingerprintHash
    });

    expect(expiredResult.valid).toBe(false);
    expect(expiredResult.reason).toContain("expired");
    expect(wrongWorktree.valid).toBe(false);
    expect(wrongWorktree.reason).toContain("worktree");
  });
});
