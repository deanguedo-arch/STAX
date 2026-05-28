import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  approveProofSurfaces,
  discoverProofSurfaces,
  loadSidecarProofSurfacePack,
  proofSurfacePromptHint
} from "../src/projectControl/ProofSurfacePack.js";
import { attachStaxToRepo } from "../src/sidecar/AttachStax.js";
import { createTempGitRepo } from "./sidecarTestHelpers.js";

describe("repo proof-surface discovery", () => {
  it("generates build and test proof surfaces for a Node repo", async () => {
    const repoPath = await createRepoWithPackage({ build: "tsc", test: "vitest run" });

    const result = await discoverProofSurfaces(repoPath);
    const claimTypes = result.pack.proofSurfaces.map((surface) => surface.claimType);

    expect(result.pack.status).toBe("candidate");
    expect(result.pack.detectedStack).toContain("node");
    expect(claimTypes).toContain("build_ready");
    expect(claimTypes).toContain("tests_passed");
    expect(claimTypes).toContain("repo_identity");
    expect(await fs.readFile(result.reviewPath, "utf8")).toContain("Decision Needed");
  });

  it("marks publish, sync, and deploy actions blocked pending preflight", async () => {
    const repoPath = await createRepoWithPackage({
      deploy: "firebase deploy",
      sync: "node tools/sync-sheets.js",
      preflight: "node tools/validate-target.js"
    });

    const { pack } = await discoverProofSurfaces(repoPath);

    expect(pack.proofSurfaces.map((surface) => surface.claimType)).toContain("publish_sync_deploy_ready");
    expect(pack.blockedActions.map((action) => action.action)).toEqual(expect.arrayContaining(["npm run deploy", "npm run sync"]));
    expect(pack.blockedActions[0]?.requires).toContain("non-mutating preflight proof");
  });

  it("discovers publish/sync/preflight surfaces from local tool and command files", async () => {
    const repoPath = await createRepoWithPackage({ "build:pages": "node tools/build-pages.js" });
    await fs.mkdir(path.join(repoPath, "tools"), { recursive: true });
    await fs.writeFile(path.join(repoPath, "tools", "validate-sync-surface.ps1"), "Write-Output ok\n", "utf8");
    await fs.writeFile(path.join(repoPath, "tools", "validate-canonical.ps1"), "Write-Output ok\n", "utf8");
    await fs.writeFile(path.join(repoPath, "SYNC_ALL.cmd"), "echo sync\n", "utf8");
    await fs.writeFile(path.join(repoPath, "PUBLISH_DATA_TO_SHEETS.bat"), "echo publish\n", "utf8");

    const { pack } = await discoverProofSurfaces(repoPath);
    const publish = pack.proofSurfaces.find((surface) => surface.claimType === "publish_sync_deploy_ready");

    expect(publish?.commands).toEqual(expect.arrayContaining(["tools/validate-sync-surface.ps1", "tools/validate-canonical.ps1"]));
    expect(pack.blockedActions.map((action) => action.action)).toEqual(
      expect.arrayContaining(["SYNC_ALL.cmd", "PUBLISH_DATA_TO_SHEETS.bat"])
    );
  });

  it("does not treat script/test source files as direct proof commands or blocked live actions", async () => {
    const repoPath = await createRepoWithPackage({ "test:e2e": "playwright test", "test:apps-script": "vitest run apps" });
    await fs.mkdir(path.join(repoPath, "scripts", "tests"), { recursive: true });
    await fs.writeFile(path.join(repoPath, "scripts", "tests", "calm-google-hosted-sidebar-hosts.test.ts"), "export {};\n", "utf8");
    await fs.writeFile(path.join(repoPath, "scripts", "smoke-local-pipeline.ts"), "export {};\n", "utf8");
    await fs.mkdir(path.join(repoPath, "tools"), { recursive: true });
    await fs.writeFile(path.join(repoPath, "tools", "test-release-gate-smoke.js"), "export {};\n", "utf8");
    await fs.writeFile(path.join(repoPath, "tools", "check-dataset-quality-fixtures.py"), "print('ok')\n", "utf8");
    await fs.writeFile(path.join(repoPath, "publish-course-showcase.bat"), "echo publish\n", "utf8");
    await fs.writeFile(path.join(repoPath, "PUBLISH_DATA_TO_SHEETS.bat"), "echo publish\n", "utf8");

    const { pack } = await discoverProofSurfaces(repoPath);
    const allCommands = pack.proofSurfaces.flatMap((surface) => surface.commands);
    const blockedActions = pack.blockedActions.map((action) => action.action);
    const data = pack.proofSurfaces.find((surface) => surface.claimType === "data_pipeline_ready");

    expect(allCommands).not.toContain("scripts/tests/calm-google-hosted-sidebar-hosts.test.ts");
    expect(allCommands).not.toContain("scripts/smoke-local-pipeline.ts");
    expect(blockedActions).not.toContain("scripts/tests/calm-google-hosted-sidebar-hosts.test.ts");
    expect(blockedActions).not.toContain("tools/test-release-gate-smoke.js");
    expect(blockedActions).not.toContain("npm run test:apps-script");
    expect(blockedActions).toContain("publish-course-showcase.bat");
    expect(blockedActions).toContain("PUBLISH_DATA_TO_SHEETS.bat");
    expect(data?.commands).toContain("tools/check-dataset-quality-fixtures.py");
    expect(data?.commands).not.toContain("PUBLISH_DATA_TO_SHEETS.bat");
  });

  it("does not classify publish scripts with building in the name as build proof commands", async () => {
    const repoPath = await createRepoWithPackage({ build: "tsc" });
    await fs.writeFile(path.join(repoPath, "publish-ai-course-building-resources.bat"), "echo publish\n", "utf8");

    const { pack } = await discoverProofSurfaces(repoPath);
    const build = pack.proofSurfaces.find((surface) => surface.claimType === "build_ready");

    expect(build?.commands).toContain("npm run build");
    expect(build?.commands).not.toContain("publish-ai-course-building-resources.bat");
    expect(pack.blockedActions.map((action) => action.action)).toContain("publish-ai-course-building-resources.bat");
  });

  it("detects visual/layout proof requirements for HTML/CSS workspaces", async () => {
    const repoPath = await createRepoWithPackage({ "test:e2e": "playwright test" });
    await fs.mkdir(path.join(repoPath, "workspace"), { recursive: true });
    await fs.writeFile(path.join(repoPath, "workspace", "styles.css"), "body { color: red; }\n", "utf8");

    const { pack } = await discoverProofSurfaces(repoPath);
    const visual = pack.proofSurfaces.find((surface) => surface.claimType === "visual_ready");

    expect(visual?.requiredEvidence).toContain("rendered_screenshot");
    expect(visual?.requiredEvidence).toContain("visual_checklist");
    expect(visual?.blockedEvidence).toContain("css_diff_only");
  });

  it("does not recommend mutating smoke pipeline commands as visual proof", async () => {
    const repoPath = await createRepoWithPackage({
      "test:e2e": "playwright test",
      "smoke:pipeline": "tsx scripts/smoke-local-pipeline.ts",
      "test:e2e:smoke": "playwright test --grep @smoke"
    });
    await fs.mkdir(path.join(repoPath, "workspace"), { recursive: true });
    await fs.writeFile(path.join(repoPath, "workspace", "styles.css"), "body { color: red; }\n", "utf8");

    const { pack } = await discoverProofSurfaces(repoPath);
    const visual = pack.proofSurfaces.find((surface) => surface.claimType === "visual_ready");

    expect(visual?.commands).toContain("npm run test:e2e:smoke");
    expect(visual?.commands).not.toContain("npm run smoke:pipeline");
    expect(visual?.nextAction).toContain("npm run test:e2e:smoke");
  });

  it("detects course deploy proof requirements for Google-hosted course workspaces", async () => {
    const repoPath = await createRepoWithPackage({
      "build:course-shell": "node scripts/build-course-shell.js",
      "export:google-hosted": "node scripts/export-google-hosted.js",
      "deploy:google-hosted": "firebase deploy --only hosting",
      "test:e2e:project": "playwright test",
      "smoke:pipeline": "tsx scripts/smoke-local-pipeline.ts"
    });
    await fs.mkdir(path.join(repoPath, "projects", "demo", "workspace"), { recursive: true });
    await fs.writeFile(path.join(repoPath, "projects", "demo", "workspace", "index.html"), "<main></main>\n", "utf8");

    const { pack } = await discoverProofSurfaces(repoPath);
    const courseDeploy = pack.proofSurfaces.find((surface) => surface.claimType === "course_deploy_ready");

    expect(courseDeploy).toBeTruthy();
    expect(courseDeploy?.requiredEvidence).toEqual(
      expect.arrayContaining(["workspace_source_diff", "export_regenerated", "stax_collected_deploy_command", "live_target_fetch"])
    );
    expect(courseDeploy?.commands).toEqual(expect.arrayContaining(["npm run export:google-hosted", "npm run deploy:google-hosted"]));
  });

  it("does not assign course deploy proof contracts to non-course app sync/export repos", async () => {
    const repoPath = await createRepoWithPackage({ "build:pages": "node tools/build-pages.js" });
    await fs.mkdir(path.join(repoPath, "docs"), { recursive: true });
    await fs.writeFile(path.join(repoPath, "docs", "index.html"), "<main></main>\n", "utf8");
    await fs.mkdir(path.join(repoPath, "tools"), { recursive: true });
    await fs.writeFile(path.join(repoPath, "tools", "export-appsscript-bundles.ps1"), "Write-Output ok\n", "utf8");
    await fs.writeFile(path.join(repoPath, "tools", "validate-sync-surface.ps1"), "Write-Output ok\n", "utf8");
    await fs.writeFile(path.join(repoPath, "SYNC_ALL.cmd"), "echo sync\n", "utf8");

    const { pack } = await discoverProofSurfaces(repoPath);

    expect(pack.proofSurfaces.map((surface) => surface.claimType)).not.toContain("course_deploy_ready");
    expect(pack.proofSurfaces.map((surface) => surface.claimType)).toContain("publish_sync_deploy_ready");
  });

  it("warns that gold or fixture updates are not repair proof", async () => {
    const repoPath = await createRepoWithPackage({ "ingest:seed-gold": "node scripts/seed-gold.js" });

    const { pack } = await discoverProofSurfaces(repoPath);
    const gold = pack.proofSurfaces.find((surface) => surface.claimType === "gold_fixture_update");

    expect(gold?.blockedEvidence).toContain("seed_gold_only");
  });

  it("keeps candidates provisional until approved", async () => {
    const repoPath = await createRepoWithPackage({ build: "tsc" });
    await attachStaxToRepo(repoPath);
    await discoverProofSurfaces(repoPath);

    const before = await loadSidecarProofSurfacePack(repoPath);
    expect(before.approved).toBe(false);
    expect(before.pack?.status).toBe("candidate");

    const approved = await approveProofSurfaces(repoPath);
    const after = await loadSidecarProofSurfacePack(repoPath);

    expect(after.approved).toBe(true);
    expect(after.pack?.status).toBe("approved");
    await expect(fs.stat(approved.eventPath)).resolves.toBeTruthy();
  });

  it("skips secrets and env files while preserving example config hints", async () => {
    const repoPath = await createRepoWithPackage({ build: "tsc" });
    await fs.writeFile(path.join(repoPath, ".env"), "TOKEN=secret\n", "utf8");
    await fs.mkdir(path.join(repoPath, "config"), { recursive: true });
    await fs.writeFile(path.join(repoPath, "config", "sheets_sync.json.example"), "{}\n", "utf8");

    const { pack } = await discoverProofSurfaces(repoPath);
    const candidateRaw = await fs.readFile(path.join(repoPath, ".stax", "proof-surfaces.candidate.json"), "utf8");

    expect(candidateRaw).not.toContain("TOKEN=secret");
    expect(candidateRaw).not.toContain(".env");
    expect(pack.proofSurfaces.map((surface) => surface.claimType)).toContain("repo_identity");
  });

  it("uses approved surfaces as specific next-prompt hints and candidate surfaces as provisional hints", async () => {
    const repoPath = await createRepoWithPackage({ "test:e2e": "playwright test" });
    await fs.mkdir(path.join(repoPath, "workspace"), { recursive: true });
    await fs.writeFile(path.join(repoPath, "workspace", "styles.css"), "body { color: red; }\n", "utf8");
    await attachStaxToRepo(repoPath);
    await discoverProofSurfaces(repoPath);

    const candidateHint = await proofSurfacePromptHint({
      repoPath,
      reportText: "CSS diff proves the layout is ready.",
      unverified: ["Visual/style claim lacks rendered visual proof."],
      risk: []
    });
    expect(candidateHint).toContain("Candidate proof surface");
    expect(candidateHint).toContain("candidate-only");

    await approveProofSurfaces(repoPath);
    const approvedHint = await proofSurfacePromptHint({
      repoPath,
      reportText: "CSS diff proves the layout is ready.",
      unverified: ["Visual/style claim lacks rendered visual proof."],
      risk: []
    });
    expect(approvedHint).toContain("Approved proof surface");
    expect(approvedHint).not.toContain("candidate-only");
  });

  it("does not append unsafe live-action commands to course deploy next-prompt hints", async () => {
    const repoPath = await createTempGitRepo("stax-proof-surface-course-deploy-");
    await fs.mkdir(path.join(repoPath, ".stax"), { recursive: true });
    await fs.writeFile(
      path.join(repoPath, ".stax", "proof-surfaces.json"),
      `${JSON.stringify(
        {
          schemaVersion: "stax-proof-surface-pack-v1",
          repoName: "canvas-helper",
          status: "approved",
          proofSurfaces: [
            {
              claimType: "course_deploy_ready",
              requiredEvidence: ["workspace_source_diff", "live_target_fetch", "rendered_screenshot"],
              commands: ["npm run deploy:google-hosted", "npm run test:e2e:project"],
              blockedEvidence: ["deploy_command_only"],
              source: "test fixture",
              nextAction:
                "For course deploys, prove the source workspace changed, regenerate the export, collect the deploy command through STAX, verify the live target, and capture rendered visual proof."
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const hint = await proofSurfacePromptHint({
      repoPath,
      reportText: "Claim-to-proof: release_deploy claim is unsupported because target_environment_proof is missing.",
      unverified: [],
      risk: []
    });

    expect(hint).toContain("Approved proof surface for course_deploy_ready");
    expect(hint).toContain("capture rendered visual proof");
    expect(hint).not.toContain("Suggested command: npm run deploy:google-hosted");
  });

  it("does not blindly suggest the first test script when no specific command matched the report", async () => {
    const repoPath = await createTempGitRepo("stax-proof-surface-test-hint-");
    await fs.mkdir(path.join(repoPath, ".stax"), { recursive: true });
    await fs.writeFile(
      path.join(repoPath, ".stax", "proof-surfaces.json"),
      `${JSON.stringify(
        {
          schemaVersion: "stax-proof-surface-pack-v1",
          repoName: "canvas-helper",
          status: "approved",
          proofSurfaces: [
            {
              claimType: "tests_passed",
              requiredEvidence: ["local_command_output", "target_repo_cwd"],
              commands: ["npm run test:apps-script", "npm run smoke:pipeline"],
              blockedEvidence: [],
              source: "test fixture",
              nextAction: "Run npm run test:apps-script through stax:collect in the target repo."
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const hint = await proofSurfacePromptHint({
      repoPath,
      reportText: "Python DOCX style-profile tests passed through STAX command evidence.",
      unverified: ["Command evidence classifier: non_execution_evidence for python3 -m py_compile."],
      risk: []
    });

    expect(hint).toContain("Approved proof surface for tests_passed");
    expect(hint).toContain("Run the relevant test, verification, or compile command through stax:collect");
    expect(hint).not.toContain("npm run test:apps-script");
  });
});

async function createRepoWithPackage(scripts: Record<string, string>): Promise<string> {
  const repoPath = await createTempGitRepo("stax-proof-surface-");
  await fs.writeFile(path.join(repoPath, "package.json"), `${JSON.stringify({ scripts }, null, 2)}\n`, "utf8");
  return repoPath;
}
