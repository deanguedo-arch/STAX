import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { matchProofSurface } from "../src/projectControl/ProofSurfaceMatcher.js";
import {
  approveProofSurfaces,
  discoverProofSurfaces,
  proofSurfacePromptHint
} from "../src/projectControl/ProofSurfacePack.js";
import { ProofSurfacePackSchema, type ProofSurfacePack } from "../src/projectControl/ProofSurfacePackSchemas.js";
import { attachStaxToRepo } from "../src/sidecar/AttachStax.js";
import { createTempGitRepo } from "./sidecarTestHelpers.js";

describe("ProofSurfaceMatcher adversarial routing", () => {
  it("routes docs that mention deploy to deploy proof requirements, not acceptance", async () => {
    const pack = await readPack("proof-surfaces/admission-app.json");

    const match = matchProofSurface({
      pack,
      text: "The release notes mention deploy readiness, but no target validation, rollback, or preflight output is attached."
    });

    expect(match?.surface.claimType).toBe("publish_sync_deploy_ready");
    expect(match?.surface.requiredEvidence).toEqual(
      expect.arrayContaining(["preflight_output", "target_validation", "explicit_human_approval"])
    );
    expect(match?.surface.nextAction).toContain("preflight validation");
  });

  it("routes release-note deploy mentions to deploy proof requirements, not deploy readiness", async () => {
    const pack = await readPack("proof-surfaces/admission-app.json");

    const match = matchProofSurface({
      pack,
      text: "The release notes mention deploy and publish, so the sync is ready."
    });

    expect(match?.surface.claimType).toBe("publish_sync_deploy_ready");
    expect(match?.surface.requiredEvidence).toEqual(
      expect.arrayContaining(["preflight_output", "target_validation", "explicit_human_approval"])
    );
  });

  it("routes package test script existence to required test proof, not a passed-test claim", async () => {
    const pack = await readPack("proof-surfaces/stax.json");

    const match = matchProofSurface({
      pack,
      text: "package.json has an npm test script, but there is no local command evidence proving tests passed."
    });

    expect(match?.surface.claimType).toBe("tests_passed");
    expect(match?.surface.requiredEvidence).toEqual(
      expect.arrayContaining(["local_command_output", "target_repo_cwd", "matching_worktree_fingerprint"])
    );
    expect(match?.surface.nextAction).toContain("Run the relevant test command");
  });

  it("routes workflow existence to CI/test proof requirements, not CI passed", async () => {
    const pack = await readPack("proof-surfaces/stax.json");

    const match = matchProofSurface({
      pack,
      text: ".github/workflows/staxcore-strict.yml exists, so CI passed."
    });

    expect(match?.surface.claimType).toBe("tests_passed");
    expect(match?.surface.requiredEvidence).toEqual(
      expect.arrayContaining(["local_command_output", "target_repo_cwd", "matching_worktree_fingerprint"])
    );
  });

  it("routes coverage report existence to test proof requirements, not coverage acceptance", async () => {
    const pack = await readPack("proof-surfaces/stax.json");

    const match = matchProofSurface({
      pack,
      text: "coverage/index.html exists, so coverage is acceptable."
    });

    expect(match?.surface.claimType).toBe("tests_passed");
    expect(match?.surface.nextAction).toContain("Run the relevant test command");
  });

  it("routes screenshot path existence to visual proof requirements, not visual acceptance", async () => {
    const pack = await readPack("proof-surfaces/canvas-helper.json");

    const match = matchProofSurface({
      pack,
      text: "A screenshot file path exists in docs/screenshots/layout.png, but no rendered checklist proves the visual pass."
    });

    expect(match?.surface.claimType).toBe("visual_ready");
    expect(match?.surface.requiredEvidence).toEqual(expect.arrayContaining(["rendered_screenshot", "visual_checklist"]));
  });

  it("routes seed-gold output to Brightspace ingest repair proof requirements", async () => {
    const pack = await readPack("proof-surfaces/brightspacequizexporter.json");

    const match = matchProofSurface({
      pack,
      text: "npm run ingest:seed-gold ran successfully, so ingest is fixed."
    });

    expect(match?.surface.claimType).toBe("ingest_ready");
    expect(match?.signals.join("\n")).toContain("blocked evidence matched: npm run ingest:seed-gold");
    expect(match?.surface.nextAction).toContain("seed-gold is not repair proof");
  });

  it("routes SYNC_ALL command existence to sync safety proof requirements", async () => {
    const pack = await readPack("proof-surfaces/admission-app.json");

    const match = matchProofSurface({
      pack,
      text: "SYNC_ALL.cmd exists, so sync is safe to run."
    });

    expect(match?.surface.claimType).toBe("publish_sync_deploy_ready");
    expect(match?.surface.blockedEvidence).toContain("script_exists_only");
  });

  it("routes config example existence to sync proof requirements, not real config proof", async () => {
    const pack = await readPack("proof-surfaces/admission-app.json");

    const match = matchProofSurface({
      pack,
      text: "config/sheets_sync.json.example exists, so Sheets sync is configured."
    });

    expect(match?.surface.claimType).toBe("publish_sync_deploy_ready");
    expect(match?.surface.requiredEvidence).toEqual(expect.arrayContaining(["preflight_output", "target_validation"]));
  });

  it("routes preflight script existence to preflight output requirements, not preflight passed", async () => {
    const pack = await readPack("proof-surfaces/admission-app.json");

    const match = matchProofSurface({
      pack,
      text: "tools/validate-sync-surface.ps1 exists, so preflight passed."
    });

    expect(match?.surface.claimType).toBe("publish_sync_deploy_ready");
    expect(match?.surface.blockedEvidence).toContain("script_exists_only");
    expect(match?.surface.nextAction).toContain("Run sync/app-script/canonical preflight validation");
  });

  it("routes wrong-repo command output to repo identity before test proof", async () => {
    const pack = await readPack("proof-surfaces/brightspacequizexporter.json");

    const match = matchProofSurface({
      pack,
      text: "npm test passed, but the command output came from canvas-helper instead of brightspacequizexporter."
    });

    expect(match?.surface.claimType).toBe("repo_identity");
    expect(match?.surface.nextAction).toContain("wrong-repo output cannot verify this repo");
  });

  it("keeps Codex-reported build success as a build proof request without local command evidence", async () => {
    const pack = await readPack("proof-surfaces/stax.json");

    const match = matchProofSurface({
      pack,
      text: "Codex says build passed, but there is no verified local command evidence."
    });

    expect(match?.surface.claimType).toBe("build_ready");
    expect(match?.surface.requiredEvidence).toEqual(expect.arrayContaining(["typecheck_output", "test_output"]));
  });

  it("keeps discovered candidate surfaces provisional until approval", async () => {
    const repoPath = await createTempGitRepo("stax-candidate-surface-");
    await fs.writeFile(path.join(repoPath, "package.json"), `${JSON.stringify({ scripts: { test: "vitest run" } }, null, 2)}\n`, "utf8");
    await attachStaxToRepo(repoPath);
    await discoverProofSurfaces(repoPath);

    const candidateHint = await proofSurfacePromptHint({
      repoPath,
      reportText: "Codex says tests passed.",
      unverified: ["No local command evidence proves tests passed."],
      risk: []
    });
    expect(candidateHint).toContain("Candidate proof surface");
    expect(candidateHint).toContain("candidate-only");

    await approveProofSurfaces(repoPath);
    const approvedHint = await proofSurfacePromptHint({
      repoPath,
      reportText: "Codex says tests passed.",
      unverified: ["No local command evidence proves tests passed."],
      risk: []
    });
    expect(approvedHint).toContain("Approved proof surface");
    expect(approvedHint).not.toContain("candidate-only");
  });
});

async function readPack(relativePath: string): Promise<ProofSurfacePack> {
  const raw = await fs.readFile(path.join(process.cwd(), relativePath), "utf8");
  return ProofSurfacePackSchema.parse(JSON.parse(raw) as unknown);
}
