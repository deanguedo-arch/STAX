import { describe, expect, it } from "vitest";
import { findRepoProofSurface, getRepoProofSurface, listRepoProofSurfaces } from "../src/projectControl/RepoProofSurfaceRegistry.js";

describe("RepoProofSurfaceRegistry", () => {
  it("seeds ADMISSION-APP proof surfaces and blocked live actions", () => {
    const surface = getRepoProofSurface("admission_app");

    expect(surface.commands.build).toBe("npm run build:pages");
    expect(surface.commands.syncPreflight).toContain("tools/validate-sync-surface.ps1");
    expect(surface.commands.appsScriptValidation).toContain("tools/validate-apps-script-structure.ps1");
    expect(surface.commands.canonicalValidation).toContain("tools/validate-canonical.ps1");
    expect(surface.files.requiredSheetsConfig).toBe("config/sheets_sync.json");
    expect(surface.files.exampleSheetsConfig).toBe("config/sheets_sync.json.example");
    expect(surface.blockedLiveActions).toEqual(expect.arrayContaining(["SYNC_ALL.cmd", "PUBLISH_DATA_TO_SHEETS.bat", "SYNC_PROGRAMS.cmd"]));
  });

  it("seeds canvas-helper visual proof surfaces", () => {
    const surface = getRepoProofSurface("canvas_helper");

    expect(surface.commands.build).toBe("npm run build:studio");
    expect(surface.commands.courseShellTest).toBe("npm run test:course-shell");
    expect(surface.commands.e2e).toBe("npm run test:e2e");
    expect(surface.commands.scopedE2e).toBe("npm run test:e2e:project");
    expect(surface.proofArtifacts).toContain("rendered screenshot/checklist");
    expect(surface.notes.join(" ")).toContain("CSS diff alone is not visual proof");
  });

  it("seeds Brightspace build, ingest, and seed-gold boundaries", () => {
    const surface = getRepoProofSurface("brightspacequizexporter");

    expect(surface.commands.dependencyProof).toBe("npm ls @rollup/rollup-darwin-arm64 rollup vite");
    expect(surface.commands.build).toBe("npm run build");
    expect(surface.commands.ingestGate).toBe("npm run ingest:ci");
    expect(surface.commands.forbiddenSeedGold).toBe("npm run ingest:seed-gold");
    expect(surface.blockedLiveActions).toContain("npm run ingest:seed-gold");
    expect(surface.notes.join(" ")).toContain("dependency/install changes are separate");
  });

  it("matches known repo aliases", () => {
    expect(findRepoProofSurface("app-admissions publish readiness")?.repoId).toBe("admission_app");
    expect(findRepoProofSurface("Sports Wellness visual proof")?.repoId).toBe("canvas_helper");
    expect(findRepoProofSurface("/Users/deanguedo/Documents/GitHub/brightspacequizexporter")?.repoId).toBe("brightspacequizexporter");
    expect(listRepoProofSurfaces()).toHaveLength(3);
  });
});
