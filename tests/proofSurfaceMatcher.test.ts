import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { matchProofSurface } from "../src/projectControl/ProofSurfaceMatcher.js";
import { ProofSurfacePackSchema, type ProofSurfacePack } from "../src/projectControl/ProofSurfacePackSchemas.js";

describe("ProofSurfaceMatcher", () => {
  it("maps Brightspace seed-gold repair claims to ingest_ready through blocked evidence", async () => {
    const pack = await readPack("proof-surfaces/brightspacequizexporter.json");

    const match = matchProofSurface({
      pack,
      text: "Ingest is fixed because npm run ingest:seed-gold passed."
    });

    expect(match?.surface.claimType).toBe("ingest_ready");
    expect(match?.signals.join("\n")).toContain("blocked evidence matched: npm run ingest:seed-gold");
  });

  it("maps Brightspace dependency and Rollup claims to dependency_ready", async () => {
    const pack = await readPack("proof-surfaces/brightspacequizexporter.json");

    const match = matchProofSurface({
      pack,
      text: "The Rollup optional dependency repair is ready after package-lock changes and npm ls @rollup/rollup-darwin-arm64 rollup vite."
    });

    expect(match?.surface.claimType).toBe("dependency_ready");
  });

  it("maps Canvas CSS visual claims to visual_ready", async () => {
    const pack = await readPack("proof-surfaces/canvas-helper.json");

    const match = matchProofSurface({
      pack,
      text: "The course layout is visually ready because the CSS diff fixed the cards."
    });

    expect(match?.surface.claimType).toBe("visual_ready");
  });

  it("maps Canvas Google-hosted course deploys to course_deploy_ready", async () => {
    const pack = await readPack("proof-surfaces/canvas-helper.json");

    const match = matchProofSurface({
      pack,
      text: "Redeploy Forensics 25 Google-hosted site after image cleanup and verify the live Firebase target."
    });

    expect(match?.surface.claimType).toBe("course_deploy_ready");
    expect(match?.surface.requiredEvidence).toEqual(
      expect.arrayContaining(["workspace_source_diff", "export_regenerated", "stax_collected_deploy_command", "live_target_fetch"])
    );
    expect(match?.surface.nextAction).toContain("source workspace");
  });

  it("routes course deploy proof gaps to the course deploy contract before generic release", async () => {
    const pack = await readPack("proof-surfaces/canvas-helper.json");

    const match = matchProofSurface({
      pack,
      text: "Claim-to-proof: release_deploy claim is unsupported because target_environment_proof is missing for the course deploy."
    });

    expect(match?.surface.claimType).toBe("course_deploy_ready");
  });

  it("maps ADMISSION sync and docs-updated claims to publish_sync_deploy_ready", async () => {
    const pack = await readPack("proof-surfaces/admission-app.json");

    const match = matchProofSurface({
      pack,
      text: "SYNC_ALL is ready because docs were updated for Sheets sync readiness."
    });

    expect(match?.surface.claimType).toBe("publish_sync_deploy_ready");
  });

  it("maps wrong-repo command evidence to repo_identity before generic test surfaces", async () => {
    const pack = await readPack("proof-surfaces/brightspacequizexporter.json");

    const match = matchProofSurface({
      pack,
      text: "Tests passed, but the command evidence came from canvas-helper instead of brightspacequizexporter."
    });

    expect(match?.surface.claimType).toBe("repo_identity");
    expect(match?.signals.join("\n")).toContain("target repo mismatch language matched");
  });

  it("maps Codex-says-tests-passed claims to tests_passed", async () => {
    const pack = await readPack("proof-surfaces/stax.json");

    const match = matchProofSurface({
      pack,
      text: "Codex says tests passed with no file list, no diff summary, and no command output."
    });

    expect(match?.surface.claimType).toBe("tests_passed");
  });

  it("prioritizes an unsupported visual proof gap over stale test command mentions", () => {
    const match = matchProofSurface({
      pack: ProofSurfacePackSchema.parse({
        schemaVersion: "stax-proof-surface-pack-v1",
        repoName: "canvas-helper",
        status: "approved",
        proofSurfaces: [
          {
            claimType: "tests_passed",
            requiredEvidence: ["local_command_output"],
            commands: ["npm run test:e2e:smoke"],
            blockedEvidence: ["codex_report_only"],
            source: "test fixture"
          },
          {
            claimType: "visual_ready",
            requiredEvidence: ["rendered_screenshot", "visual_checklist"],
            commands: ["npm run test:e2e:project"],
            blockedEvidence: ["css_diff_only"],
            source: "test fixture"
          }
        ]
      }),
      text: [
        "Command evidence classifier: stale_proof for npm run test:e2e:smoke.",
        "Claim-to-proof: visual claim is unsupported because rendered_visual_proof."
      ].join("\n")
    });

    expect(match?.surface.claimType).toBe("visual_ready");
    expect(match?.signals.join("\n")).toContain("proof gap matched");
  });
});

async function readPack(relativePath: string): Promise<ProofSurfacePack> {
  const raw = await fs.readFile(path.join(process.cwd(), relativePath), "utf8");
  return ProofSurfacePackSchema.parse(JSON.parse(raw) as unknown);
}
