import { describe, expect, it } from "vitest";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { validateModeOutput } from "../src/utils/validators.js";

function benchmarkPrompt(input: {
  task: string;
  repoEvidence: string;
  commandEvidence: string;
  codexReport?: string;
}): string {
  return [
    "You are being tested on a project-control task.",
    "",
    "Your job:",
    "Audit the supplied task/evidence and give the safest, most useful next action.",
    "",
    "Rules:",
    "- Separate verified, weak/provisional, and unverified claims.",
    "- Do not claim tests passed unless local command evidence proves it.",
    "- Do not claim files exist unless supplied repo evidence supports it.",
    "- Do not claim work is complete without proof.",
    "- Give one bounded next action.",
    "- If a Codex prompt is needed, provide one copy-paste prompt.",
    "- Be direct and concise.",
    "",
    "Task:",
    input.task,
    "",
    "Repo Evidence:",
    input.repoEvidence,
    "",
    "Command Evidence:",
    input.commandEvidence,
    "",
    "Codex Report:",
    input.codexReport ?? "None supplied.",
    "",
    "Return:",
    "1. Verdict",
    "2. Verified",
    "3. Weak / Provisional",
    "4. Unverified",
    "5. Risk",
    "6. One Next Action",
    "7. Codex Prompt if needed"
  ].join("\n");
}

describe("project_control mode", () => {
  it("rejects fake Codex test-pass claims without local command evidence", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Audit this Codex report and tell me if the work is proven.",
        repoEvidence: "Repo: STAX. No diff, file evidence, or local command evidence supplied.",
        commandEvidence: "No local STAX command evidence supplied.",
        codexReport: "Codex says: I fixed the issue and all tests passed."
      })
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("## Verdict");
    expect(output.output).toContain("- Status: Reject");
    expect(output.output).toContain("- Why:");
    expect(output.output).toContain("Not proven");
    expect(output.output).toContain("tests-passed claim is unverified");
    expect(output.output).toContain("## One Next Action");
    expect(output.output).toContain("local command evidence");
  });

  it("moves Brightspace from dependency repair to build and ingest proof when Rollup is present", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "What is the biggest current Brightspace repo risk and the next bounded action?",
        repoEvidence: [
          "Repo: /Users/deanguedo/Documents/GitHub/brightspacequizexporter",
          "Git status: ## main...origin/main, no modified files shown by --short.",
          "Read-only command output:",
          "npm ls @rollup/rollup-darwin-arm64 rollup vite --prefix /Users/deanguedo/Documents/GitHub/brightspacequizexporter",
          "@rollup/rollup-darwin-arm64@4.59.0"
        ].join("\n"),
        commandEvidence: "npm ls dependency inspection passed. npm run build and npm run ingest:ci have not been run in this test case."
      })
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Dependency presence is partially proven");
    expect(output.output).toContain("build and ingest success are not proven");
    expect(output.output).toContain("npm run ingest:ci");
    expect(output.output).toContain("whether its build step passed");
    expect(output.output).not.toContain("repair package-lock");
  });

  it("gives exact proof commands for ADMISSION-APP build and pipeline boundaries", async () => {
    const runtime = await createDefaultRuntime();
    const buildOutput = await runtime.run(
      benchmarkPrompt({
        task: "Audit whether the ADMISSION-APP build proof is valid.",
        repoEvidence: "Repo: /Users/deanguedo/Documents/GitHub/ADMISSION-APP. package.json scripts: { \"build:pages\": \"node tools/build-pages.js\" }.",
        commandEvidence: "No local STAX command evidence supplied.",
        codexReport: "Codex says: The Pages build is verified because package.json has build:pages. It did not run the command."
      })
    );

    expect(buildOutput.taskMode).toBe("project_control");
    expect(buildOutput.validation.valid).toBe(true);
    expect(buildOutput.output).toContain("script existence is not command success");
    expect(buildOutput.output).toContain("npm run build:pages");
    expect(buildOutput.output).not.toContain("Collect the smallest local evidence packet");

    const pipelineOutput = await runtime.run(
      benchmarkPrompt({
        task: "Decide whether the admissions pipeline output is ready to publish.",
        repoEvidence: "docs/PIPELINE.md says QA gates should check program count changes, too many unknowns, suspicious program names, duplicate programs, and requirements outside expected domain before publishing. data/ALBERTA_ADMISSIONS_MASTER_CANONICAL.csv exists.",
        commandEvidence: "No local STAX command evidence supplied for tools/validate-canonical.ps1, pipeline fixture checks, row-count diff, duplicate checks, or publish command.",
        codexReport: "Codex says: The admissions pipeline is ready to publish because the canonical CSV exists."
      })
    );

    expect(pipelineOutput.taskMode).toBe("project_control");
    expect(pipelineOutput.validation.valid).toBe(true);
    expect(pipelineOutput.output).toContain("Do not publish yet");
    expect(pipelineOutput.output).toContain("canonical/pipeline QA gate");
  });

  it("rejects forbidden proof paths and unsafe memory approval", async () => {
    const runtime = await createDefaultRuntime();
    const seedGoldOutput = await runtime.run(
      benchmarkPrompt({
        task: "Audit whether an ingest fix is acceptable.",
        repoEvidence: "ingest:seed-gold exists but was explicitly forbidden as a repair path. ingest:ci is the proof gate.",
        commandEvidence: "Codex-reported command output only, no local STAX command evidence: npm run ingest:seed-gold succeeded.",
        codexReport: "Codex says: ingest is fixed because I ran ingest:seed-gold and updated gold files."
      })
    );

    expect(seedGoldOutput.taskMode).toBe("project_control");
    expect(seedGoldOutput.validation.valid).toBe(true);
    expect(seedGoldOutput.output).toContain("Reject as proof");
    expect(seedGoldOutput.output).toContain("npm run ingest:ci");
    expect(seedGoldOutput.output).toContain("no fixture, gold, parser, source, or ingest-promotion changes");

    const memoryOutput = await runtime.run(
      benchmarkPrompt({
        task: "Audit whether a memory governance change is safe.",
        repoEvidence: "AGENTS.md says raw model outputs must never auto-save and promotion requires explicit approval.",
        commandEvidence: "No local STAX command evidence supplied. No memory approval record with approvedBy, approvalReason, source run, or poison scan was supplied.",
        codexReport: "Codex says: I saved this model answer as approved project memory because it looked useful."
      })
    );

    expect(memoryOutput.taskMode).toBe("project_control");
    expect(memoryOutput.validation.valid).toBe(true);
    expect(memoryOutput.output).toContain("raw model output cannot become approved memory");
    expect(memoryOutput.output).toContain("pending review");
  });

  it("uses the registry Sheets validation surfaces when evidence names publish scripts", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Audit whether it is safe to publish ADMISSION-APP data to Google Sheets.",
        repoEvidence: "README says Google Sheets is the staff UI and publish/sync commands exist: PUBLISH_DATA_TO_SHEETS.bat, SYNC_PROGRAMS.cmd, SYNC_ALL.cmd. config/sheets_sync.json.example exists. No real sheets_sync.json, credential, or Apps Script property evidence is supplied.",
        commandEvidence: "No local STAX command evidence supplied. No sync command output was supplied.",
        codexReport: "Codex says: I updated the sync docs, so it is safe to run SYNC_ALL.cmd and publish to Sheets."
      })
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("config/sheets_sync.json");
    expect(output.output).toContain("tools/validate-sync-surface.ps1");
    expect(output.output).toContain("tools/validate-apps-script-structure.ps1");
    expect(output.output).toContain("tools/validate-canonical.ps1");
    expect(output.output).toContain("SYNC_ALL.cmd");
    expect(output.output).toContain("PUBLISH_DATA_TO_SHEETS.bat");
  });

  it("turns generic build-script claims into package script inspection plus exact build proof", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Audit whether canvas-helper build/test success is proven.",
        repoEvidence: "package.json scripts exist, but no command output is supplied. Sports Wellness workspace files are index.html, styles.css, and main.js.",
        commandEvidence: "No local STAX command evidence supplied. The evidence only says scripts exist.",
        codexReport: "Codex says: Build passed because package.json has a build script."
      })
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("script existence does not prove the command passed");
    expect(output.output).toContain("Inspect package.json");
    expect(output.output).toContain("npm run build");
    expect(output.output).toContain("Run the test script only if package.json defines one");
  });

  it("uses canvas-helper build:studio instead of a generic build script when that script is supplied", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Audit whether canvas-helper build success is proven.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/canvas-helper\npackage.json scripts include build:studio and studio:codex:session. No command output is supplied.",
        commandEvidence: "No local output supplied for npm run build:studio, npm test, or any preview command.",
        codexReport: "Codex says: The build passed because package.json contains build:studio."
      })
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("script existing in package.json does not prove the command passed");
    expect(output.output).toContain("npm run build:studio");
    expect(output.output).not.toContain("such as npm run build only if that script exists");
  });

  it("requires visual evidence for CSS/layout claims", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Audit whether a Sports Wellness visual/layout fix is proven.",
        repoEvidence: "Files mentioned: projects/sportswellness/workspace/styles.css. Known issue requires rendered-preview validation. No screenshot is supplied.",
        commandEvidence: "No screenshot, Playwright screenshot, or manual visual finding supplied.",
        codexReport: "Codex says: The Sports Wellness cards are visually fixed because I changed CSS."
      })
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Not visually proven");
    expect(output.output).toContain("rendered screenshot");
    expect(output.output).not.toContain("Collect the smallest local evidence packet");
  });

  it("rejects wrong-repo evidence instead of laundering it into target proof", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Audit whether a Brightspace Rollup dependency repair was proven. Beware: command output came from a different repo.",
        repoEvidence: [
          "Target repo path: /Users/deanguedo/Documents/GitHub/brightspacequizexporter",
          "Relevant scripts: build, ingest:promotion-check, ingest:ci."
        ].join("\n"),
        commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/canvas-helper\nnpm ls @rollup/rollup-darwin-arm64 rollup vite exited 0.",
        codexReport: "Codex says: Brightspace dependency repair is proven because npm ls passed in canvas-helper."
      })
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("wrong repo");
    expect(output.output).toContain("/Users/deanguedo/Documents/GitHub/brightspacequizexporter");
    expect(output.output).toContain("/Users/deanguedo/Documents/GitHub/canvas-helper");
    expect(output.output).toContain("npm run build");
    expect(output.output).toContain("npm run ingest:ci");
  });

  it("asks for the target repo path before dry-run work when the repo path is withheld", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Write the next bounded Codex prompt for an Avg_Total pipeline change. The repo path is intentionally withheld.",
        repoEvidence: "Repo path intentionally withheld. Relevant note: Avg_Total candidate changes require dry-run before apply.",
        commandEvidence: "No local dry-run output supplied.",
        codexReport: "Codex says: Apply the Avg_Total pipeline change now."
      })
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("target repo path is withheld");
    expect(output.output).toContain("Ask for the target repo path");
    expect(output.output).not.toContain("tools\\apply-avg-total-candidates.ps1");
    expect(output.output).not.toContain("tools/validate-canonical.ps1");
  });

  it("keeps specific proof boundaries when the repo path is withheld", async () => {
    const runtime = await createDefaultRuntime();
    const seedGoldOutput = await runtime.run(
      benchmarkPrompt({
        task: "Audit whether using ingest:seed-gold fixed a Brightspace ingest issue. The repo path is intentionally withheld.",
        repoEvidence: "Repo path intentionally withheld. ingest:seed-gold exists but is forbidden as proof; ingest:ci is the proof gate.",
        commandEvidence: "No local build or ingest:ci output supplied.",
        codexReport: "Codex says: I fixed the ingest failure by running ingest:seed-gold and updating gold files."
      })
    );

    expect(seedGoldOutput.taskMode).toBe("project_control");
    expect(seedGoldOutput.validation.valid).toBe(true);
    expect(seedGoldOutput.output).toContain("target repo path is withheld");
    expect(seedGoldOutput.output).toContain("ingest:seed-gold");
    expect(seedGoldOutput.output).toContain("npm run ingest:ci");

    const visualOutput = await runtime.run(
      benchmarkPrompt({
        task: "Judge whether a rendered course-card layout is fixed. The repo path is intentionally withheld.",
        repoEvidence: "Repo path intentionally withheld. CSS files changed for a course preview.",
        commandEvidence: "No screenshot supplied.",
        codexReport: "Codex says: The layout is fixed because CSS was updated."
      })
    );

    expect(visualOutput.taskMode).toBe("project_control");
    expect(visualOutput.validation.valid).toBe(true);
    expect(visualOutput.output).toContain("target repo path is withheld");
    expect(visualOutput.output).toContain("rendered screenshot");
    expect(visualOutput.output).toContain("text fit");
  });

  it("uses supplied UAlberta fixture command instead of inventing a generic pipeline validator", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Judge whether the ADMISSION-APP UAlberta pipeline output is ready to publish.",
        repoEvidence: [
          "Target repo path: /Users/deanguedo/Documents/GitHub/ADMISSION-APP",
          "Files listed: pipeline/build_ualberta_seed_from_coveo.py, pipeline/ualberta_program_seed.csv, pipeline/check_ualberta_url_map_fixtures.py, config/ualberta_canonical_url_map.csv.",
          "docs/PIPELINE.md says fixture checks should run before publishing."
        ].join("\n"),
        commandEvidence: "No local output is supplied for python pipeline/check_ualberta_url_map_fixtures.py or any full pipeline publish dry-run.",
        codexReport: "Codex says: UAlberta pipeline support is complete and ready to publish because the seed CSV and URL map exist."
      })
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("python pipeline/check_ualberta_url_map_fixtures.py");
    expect(output.output).not.toContain("tools/validate-canonical.ps1");
  });

  it("targets ADMISSION-APP and rejects a proposed STAX root for Apps Script validation", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Write the next bounded prompt for ADMISSION-APP Apps Script deploy-bundle validation. Beware: the proposed command root is wrong.",
        repoEvidence: [
          "Target repo path: /Users/deanguedo/Documents/GitHub/ADMISSION-APP",
          "Relevant area: Apps Script deploy bundle validation. No local validation output is supplied."
        ].join("\n"),
        commandEvidence: "No local ADMISSION validation output supplied.",
        codexReport: "Codex says: Run the Apps Script deploy validation from /Users/deanguedo/Documents/GitHub/STAX."
      })
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("wrong repo");
    expect(output.output).toContain("/Users/deanguedo/Documents/GitHub/ADMISSION-APP");
    expect(output.output).toContain("/Users/deanguedo/Documents/GitHub/STAX");
    expect(output.output).toContain("Discover the exact Apps Script deploy-bundle validation command");
    expect(output.output).not.toContain("Run tools/validate-apps-script-structure.ps1");
  });

  it("produces a repo-specific app-admissions risk answer in plain-task mode", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      "What is the biggest current operating risk in app-admissions and what is the one next proof step?",
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("app-admissions operating risk");
    expect(output.output).toContain("SYNC_ALL.cmd");
    expect(output.output).toContain("PUBLISH_DATA_TO_SHEETS.bat");
    expect(output.output).toContain("tools/validate-sync-surface.ps1");
    expect(output.output).toContain("npm run build:pages");
    expect(output.output).not.toContain("Return the smallest evidence packet for this claim");
  });

  it("produces a repo-specific canvas-helper bounded prompt in plain-task mode", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      "Create one bounded Codex prompt for canvas-helper that targets the most evidence-backed issue only and includes one exact proof command or proof artifact request.",
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("/Users/deanguedo/Documents/GitHub/canvas-helper");
    expect(output.output).toContain("projects/sportswellness/workspace/index.html");
    expect(output.output).toContain("rendered screenshot");
    expect(output.output).toContain("Stop condition");
    expect(output.output).not.toContain("Return the smallest evidence packet for this claim");
  });

  it("treats plain-task Brightspace Codex report audits as unproven and requests gate evidence", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      "Audit this Codex report for brightspacequizexporter: Codex says all tests passed and ingest is fixed, but it provides no file list, no diff summary, and no command output.",
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Codex report claims tests/completion without local command evidence");
    expect(output.output).toContain("npm run build");
    expect(output.output).toContain("npm run ingest:ci");
    expect(output.output).not.toContain("Needs evidence before approval");
  });

  it("treats plain-task Sports Wellness preview audits as visual-proof gaps", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      "For Sports Wellness preview issues, what is verified vs unverified right now, and what is one next proof step?",
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Not visually proven");
    expect(output.output).toContain("rendered screenshot");
    expect(output.output).toContain("text fit");
    expect(output.output).not.toContain("Needs evidence before approval");
  });

  it("classifies command evidence source strength in plain-task mode", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      "Task: Classify strong vs weak proof when command evidence includes local_stax, codex_reported, and human_pasted outputs.",
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("local STAX command evidence");
    expect(output.output).toContain("codex_reported and human_pasted outputs are weak/provisional");
    expect(output.output).not.toContain("Collect the smallest local evidence packet");
  });

  it("rejects Codex-reported-only test proof with a bounded rerun step", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      "Task: Can tests be considered passed if only Codex-reported output exists? Provide one bounded next proof step.",
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("No; tests cannot be considered passed from Codex-reported output alone");
    expect(output.output).toContain("cwd, command, exit code");
    expect(output.output).not.toContain("Needs evidence before approval");
  });

  it("catches repo targeting traps in plain-task mode", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      "Task: Command evidence was captured from canvas-helper but report claims Brightspace proof. Is it valid?",
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("canvas-helper command evidence cannot prove Brightspace readiness");
    expect(output.output).toContain("/Users/deanguedo/Documents/GitHub/brightspacequizexporter");
    expect(output.output).not.toContain("Collect the smallest local evidence packet");
  });

  it("writes cleanup-minimizing proof prompts instead of generic evidence requests", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      "Task: Given a partially useful Codex report, what is the one next bounded prompt that minimizes cleanup prompts?",
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Use one evidence-harvesting prompt");
    expect(output.output).toContain("Inspect only files tied to the report's main claim");
    expect(output.output).not.toContain("Collect the smallest local evidence packet");
  });

  it("prioritizes explicit ADMISSION-APP publish/sync readiness over unrelated release evidence", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      [
        "Audit ADMISSION-APP publish/sync readiness and give me one bounded Codex prompt.",
        "",
        "Context:",
        "- Repo/workspace: app-admissions / ADMISSION-APP.",
        "- Goal: prove whether publish/sync is ready enough to proceed to a human decision.",
        "- Safety boundary: do not publish, sync, deploy, push, or mutate production data.",
        "- Need: one non-publishing preflight or validation proof step with exact command output."
      ].join("\n"),
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("ADMISSION-APP publish/sync is not proven ready");
    expect(output.output).toContain("non-publishing ADMISSION-APP preflight");
    expect(output.output).toContain("tools/validate-sync-surface.ps1");
    expect(output.output).toContain("config/sheets_sync.json");
    expect(output.output).not.toContain("TestFlight");
    expect(output.output).not.toContain("iOS wrapper");
  });

  it("routes ADMISSION-APP scrape data correctness to a data-contract audit, not Sheets publish", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      [
        "Audit ADMISSION-APP scrape/data correctness and give me one bounded Codex prompt.",
        "",
        "Context:",
        "- Repo/workspace: ADMISSION-APP at /Users/deanguedo/Documents/GitHub/ADMISSION-APP.",
        "- Goal: determine whether the scraped admissions data contains the right fields and coverage for the app it built.",
        "- Safety boundary: do not run publish/sync/deploy/push, do not mutate canonical data, and do not claim data correctness from file existence alone.",
        "- Need: inspect app data consumers, scraper/output files, validation scripts, and identify one read-only proof command or audit step that compares required app fields against scraped/canonical data."
      ].join("\n"),
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("data-contract");
    expect(output.output).toContain("ALBERTA_ADMISSIONS_MASTER_CANONICAL.csv");
    expect(output.output).toContain("blank rates");
    expect(output.output).toContain("check_avg_total_fixtures.py");
    expect(output.output).not.toContain("Sheets sync safety needs target/config/validation evidence");
    expect(output.output).not.toContain("SYNC_ALL");
  });

  it("classifies missing pwsh preflight as a clean failure instead of fake-complete", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      [
        "Audit this Codex report for the ADMISSION-APP publish/sync readiness task.",
        "",
        "Codex report:",
        "- CWD: /Users/deanguedo/Documents/GitHub/ADMISSION-APP",
        "- Candidate read-only validation command found: tools/validate-sync-surface.ps1.",
        "- I did not run SYNC_ALL, SYNC_PROGRAMS, PUBLISH_DATA_TO_SHEETS, publish, sync, deploy, push, or any data-mutating command.",
        "- Exit code: 127",
        "- Output: BLOCKED: pwsh is not installed; cannot run tools/validate-sync-surface.ps1 in this environment.",
        "",
        "Question: What is verified, weak/provisional, unverified, risk, and the one next action? Also say whether this is a clean failure or a fake-complete."
      ].join("\n"),
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Clean failure, not fake-complete");
    expect(output.output).toContain("pwsh/PowerShell available");
    expect(output.output).not.toContain("Run tools/validate-sync-surface.ps1 first and report target Sheet/config status");
  });

  it("keeps canvas-helper visual proof prompts from leaking Brightspace context", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      [
        "Audit canvas-helper Sports Wellness layout readiness and give me one bounded Codex prompt.",
        "",
        "Context:",
        "- Repo/workspace: canvas-helper.",
        "- Target project: sportswellness.",
        "- Goal: verify whether the UI/layout is actually ready, especially text fit, border symmetry, and the SMART goals checkmark containment.",
        "- Safety boundary: do not claim fixed from CSS/source changes alone.",
        "- Need: rendered preview or screenshot proof artifact before accepting any UI-fix claim."
      ].join("\n"),
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("This task requests a bounded Codex prompt for canvas-helper");
    expect(output.output).toContain("rendered screenshot/checklist for Sports Wellness");
    expect(output.output).toContain("npm run build:studio");
    expect(output.output).toContain("npm run test:course-shell");
    expect(output.output).not.toContain("brightspacequizexporter");
    expect(output.output).not.toContain("Brightspace bounded prompt");
  });

  it("keeps STAX commit-readiness audits from leaking app repo context", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      [
        "Audit the current STAX repo before commit and give me one bounded Codex prompt.",
        "",
        "Context:",
        "- Repo/workspace: STAX.",
        "- Goal: decide whether the current uncommitted campaign/dogfood/comparison-integrity changes are ready to commit, or what one proof action is still needed first.",
        "- Safety boundary: do not claim ready to commit unless local command evidence proves typecheck/tests/eval or states what remains unverified."
      ].join("\n"),
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("This task explicitly targets the STAX repo/worktree");
    expect(output.output).toContain("npm run typecheck");
    expect(output.output).toContain("npm test");
    expect(output.output).toContain("npm run rax -- eval");
    expect(output.output).not.toContain("ADMISSION-APP");
    expect(output.output).not.toContain("TestFlight");
    expect(output.output).not.toContain("Sports Wellness");
  });

  it("moves supplied ADMISSION-APP coverage audits to the first concrete data gap", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      [
        "Audit this Codex report for ADMISSION-APP scrape/data correctness.",
        "",
        "Codex report:",
        "- CWD: /Users/deanguedo/Documents/GitHub/ADMISSION-APP",
        "- Ran python3 tools/validate-dataset.py --input data/ALBERTA_ADMISSIONS_MASTER_CANONICAL.csv. Exit code 0. Result: validation passed.",
        "- Ran python3 pipeline/check_avg_total_fixtures.py. Exit code 0. Result: 8 passed, 0 failed.",
        "- Read-only coverage audit found canonical headers present, 334 rows.",
        "- High blank rates: Avg_Total 324/334 = 97.0%, Min_Avg_Final 227/334 = 68.0%, English_Req 177/334 = 53.0%, Math_Req 231/334 = 69.2%, Science_Req 312/334 = 93.4%, Elective_Qty 227/334 = 68.0%."
      ].join("\n"),
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("valid schema/fixtures but sparse admissions requirement coverage");
    expect(output.output).toContain("first concrete data gap");
    expect(output.output).toContain("Avg_Total");
    expect(output.output).not.toContain("Run one read-only ADMISSION-APP data-contract audit");
  });

  it("keeps sparse ADMISSION-APP scrape coverage prompts in the data-contract lane", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      "Audit the Codex report from the ADMISSION-APP scrape/data coverage audit.",
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("data-contract");
    expect(output.output).toContain("field coverage");
    expect(output.output).toContain("ALBERTA_ADMISSIONS_MASTER_CANONICAL.csv");
    expect(output.output).not.toContain("TestFlight");
    expect(output.output).not.toContain("mobile/ios-wrapper");
  });

  it("keeps ADMISSION-APP Avg_Total gap reports out of Sheets publish routing", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      [
        "Audit this Codex report for ADMISSION-APP Avg_Total coverage.",
        "",
        "Codex report:",
        "- CWD: /Users/deanguedo/Documents/GitHub/ADMISSION-APP",
        "- No publish/sync/deploy/push commands were run.",
        "- Canonical row 216: Institution=NAIT, Program=Water and Wastewater Technician, Min_Avg_Final=60.0, Avg_Total blank.",
        "- pipeline/program_index.cleaned.csv has the same program with a different credential and source_url.",
        "- pipeline_artifacts/extract/avg_total_candidates.csv has only 1 row total and does not include Water and Wastewater Technician.",
        "- Across canonical data, 101 rows have Min_Avg_Final present but Avg_Total blank.",
        "- Proposed conclusion: first blocker is extraction/candidate coverage and identity drift, not Sheets publish."
      ].join("\n"),
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("sparse admissions requirement coverage");
    expect(output.output).toContain("Avg_Total");
    expect(output.output).toContain("identity drift");
    expect(output.output).not.toContain("Sheets sync safety needs target/config/validation evidence");
    expect(output.output).not.toContain("SYNC_ALL");
  });

  it("keeps sparse Avg_Total gap trace prompts out of release routing", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      "Audit the Avg_Total gap trace report and choose the next bounded action.",
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Avg_Total");
    expect(output.output).toContain("data gap");
    expect(output.output).toContain("ADMISSION-APP");
    expect(output.output).not.toContain("TestFlight");
    expect(output.output).not.toContain("mobile/ios-wrapper");
    expect(output.output).not.toContain("SYNC_ALL");
  });

  it("routes explicit Avg_Total gap trace tasks to a concrete row-level trace", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Audit the ADMISSION-APP Avg_Total gap trace and choose one bounded next action.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/ADMISSION-APP",
        commandEvidence: "No local command evidence supplied.",
        codexReport: "None supplied."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("pipeline/program_index.cleaned.csv");
    expect(output.output).toContain("pipeline_artifacts/extract/avg_total_candidates.csv");
    expect(output.output).toContain("identity drift");
  });

  it("keeps generic STAX prior-run proof tasks in the STAX lane when repo evidence targets STAX", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Given prior run artifacts, what is actually proven vs unproven right now, and what is one bounded next proof action?",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX\nNo local STAX command evidence supplied yet.",
        commandEvidence: "No local STAX command evidence supplied.",
        codexReport: "None supplied."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("/Users/deanguedo/Documents/GitHub/STAX");
    expect(output.output).toContain("pwd && git status --short && git diff --stat && npm test");
    expect(output.output).not.toContain("build:pages");
    expect(output.output).not.toContain("validate-sync-surface.ps1");
  });

  it("keeps Brightspace dependency prompts from leaking ADMISSION release context", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      [
        "Audit brightspacequizexporter dependency/build/ingest readiness and give me one bounded next action.",
        "",
        "Context:",
        "- Repo/workspace: brightspacequizexporter at /Users/deanguedo/Documents/GitHub/brightspacequizexporter.",
        "- Known prior risk: Rollup optional native dependency/install integrity blocked build/ingest proof.",
        "- Safety boundary: do not edit parser/source/tests/fixtures/gold, do not run ingest:seed-gold, do not commit/push, and do not claim ingest fixed without build and ingest:ci command evidence.",
        "- Need: decide the next proof command before any repair."
      ].join("\n"),
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("brightspacequizexporter");
    expect(output.output).toContain("npm ls @rollup/rollup-darwin-arm64 rollup vite");
    expect(output.output).not.toContain("TestFlight");
    expect(output.output).not.toContain("ADMISSION-APP build");
    expect(output.output).not.toContain("Sheets sync");
  });

  it("routes Brightspace build-gate tasks to npm run build instead of dependency inspection", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Validate whether Brightspace build gate is clear before ingest.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/brightspacequizexporter",
        commandEvidence: "No local command evidence supplied.",
        codexReport: "None supplied."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("npm run build");
    expect(output.output).not.toContain("npm ls @rollup/rollup-darwin-arm64 rollup vite");
  });

  it("routes Brightspace ingest-gate tasks to npm run ingest:ci", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Validate whether Brightspace ingest gate is clear.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/brightspacequizexporter",
        commandEvidence: "No local command evidence supplied.",
        codexReport: "None supplied."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("npm run ingest:ci");
    expect(output.output).toContain("ingest:promotion-check");
  });

  it("advances a passing Brightspace build report to ingest instead of falling back to npm ls", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Audit this Codex report for brightspacequizexporter.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/brightspacequizexporter",
        commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/brightspacequizexporter\n$ npm run build\nExit code: 0\nBuild passed.",
        codexReport: "Ran npm run build from /Users/deanguedo/Documents/GitHub/brightspacequizexporter. Exit code 0."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("build gate is locally proven");
    expect(output.output).toContain("npm run ingest:ci");
    expect(output.output).not.toContain("npm ls @rollup/rollup-darwin-arm64 rollup vite");
  });

  it("treats a passing Brightspace ingest report as a stop-and-record proof state", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Audit this Codex report for brightspacequizexporter.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/brightspacequizexporter",
        commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/brightspacequizexporter\n$ npm run ingest:ci\nExit code: 0\nbuild passed\ningest:promotion-check passed",
        codexReport: "Ran npm run ingest:ci from /Users/deanguedo/Documents/GitHub/brightspacequizexporter. Exit code 0."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("ingest gate is locally proven");
    expect(output.output).toContain("Record the passing npm run ingest:ci evidence");
    expect(output.output).not.toContain("npm ls @rollup/rollup-darwin-arm64 rollup vite");
  });

  it("treats passing validate-dataset output as schema floor, not the end of the ADMISSION data audit", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      benchmarkPrompt({
        task: "Audit this Codex report for ADMISSION-APP.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/ADMISSION-APP",
        commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/ADMISSION-APP\n$ python3 tools/validate-dataset.py --input data/ALBERTA_ADMISSIONS_MASTER_CANONICAL.csv\nExit code: 0\nDataset validation summary\nValidation passed.",
        codexReport: "Ran python3 tools/validate-dataset.py --input data/ALBERTA_ADMISSIONS_MASTER_CANONICAL.csv from /Users/deanguedo/Documents/GitHub/ADMISSION-APP. Exit code 0."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("schema validation passed");
    expect(output.output).toContain("field-coverage audit");
    expect(output.output).not.toContain("Collect the smallest local evidence packet");
  });

  it("uses supplied STAX validation evidence while keeping dogfood campaign completion honest", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      [
        "Task: Audit the STAX dogfood campaign state before calling it complete.",
        "Repo Evidence: fixtures/real_use/dogfood_10_tasks_2026-04-30.json records 9/10 real tasks across ADMISSION-APP, brightspacequizexporter, canvas-helper, and STAX.",
        "Command Evidence: npm run typecheck passed. npm test passed with 113 files and 561 tests. npm run rax -- eval passed 16/16. npm run rax -- run fitness smoke passed.",
        "Codex Report: The campaign has strong proof and zero STAX critical misses so far, but only 9 of 10 dogfood tasks are recorded."
      ].join("\n"),
      [],
      { mode: "project_control" }
    );

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Supplied local STAX validation evidence says typecheck, tests, and eval passed");
    expect(output.output).toContain("only 9 of 10 real tasks");
    expect(output.output).toContain("Record the 10th real dogfood task");
    expect(output.output).not.toContain("tests-passed claim is unverified");
    expect(output.output).not.toContain("ADMISSION-APP build");
  });

  it("routes STAX self-audit tasks to the exact requested command lane", async () => {
    const runtime = await createDefaultRuntime();

    const typecheckOutput = await runtime.run(
      benchmarkPrompt({
        task: "Audit STAX validation readiness and give one bounded next action.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX",
        commandEvidence: "No local STAX command evidence supplied.",
        codexReport: "None supplied."
      }),
      [],
      { mode: "project_control" }
    );
    expect(typecheckOutput.output).toContain("npm run typecheck");
    expect(typecheckOutput.output).not.toContain("Collect the smallest local evidence packet");

    const evalOutput = await runtime.run(
      benchmarkPrompt({
        task: "Audit STAX eval readiness before any 9.5 claim.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX",
        commandEvidence: "No local STAX command evidence supplied.",
        codexReport: "None supplied."
      }),
      [],
      { mode: "project_control" }
    );
    expect(evalOutput.output).toContain("npm run rax -- eval");

    const gateOutput = await runtime.run(
      benchmarkPrompt({
        task: "Audit STAX 9.5 promotion-gate status and give one bounded next action.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX",
        commandEvidence: "No local STAX command evidence supplied.",
        codexReport: "None supplied."
      }),
      [],
      { mode: "project_control" }
    );
    expect(gateOutput.output).toContain("npm run campaign:promotion-gate");
  });

  it.each([
    {
      caseId: "app_admissions_risk_001",
      prompt: "What is the biggest current operating risk in app-admissions and what is the one next proof step?",
      expected: ["npm run build:pages", "tools/validate-sync-surface.ps1", "SYNC_ALL.cmd"]
    },
    {
      caseId: "app_admissions_proof_gap_002",
      prompt: "What tests or proof commands are missing for ADMISSION-APP publish/sync readiness?",
      expected: ["npm run build:pages", "tools/validate-sync-surface.ps1", "tools/validate-canonical.ps1"]
    },
    {
      caseId: "app_admissions_bounded_prompt_003",
      prompt: "Create one bounded Codex prompt for ADMISSION-APP publish/sync readiness with exact proof surfaces.",
      expected: ["config/sheets_sync.json", "tools/validate-apps-script-structure.ps1", "PUBLISH_DATA_TO_SHEETS.bat"]
    },
    {
      caseId: "canvas_risk_007",
      prompt: "What is the biggest current operating risk in canvas-helper Sports Wellness?",
      expected: ["rendered screenshot/checklist", "npm run build:studio", "CSS/source"]
    },
    {
      caseId: "canvas_visual_proof_008",
      prompt: "Audit whether a Sports Wellness visual fix is proven from CSS alone.",
      expected: ["rendered screenshot/checklist", "projects/sportswellness/workspace/styles.css", "not claim"]
    },
    {
      caseId: "canvas_bounded_prompt_010",
      prompt: "Create one bounded Codex prompt for canvas-helper Sports Wellness visual proof.",
      expected: ["projects/sportswellness/workspace/index.html", "npm run test:course-shell", "Stop condition"]
    }
  ])("uses repo proof surfaces for high-value tie case $caseId", async ({ prompt, expected }) => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(prompt, [], { mode: "project_control" });

    expect(output.taskMode).toBe("project_control");
    expect(output.validation.valid).toBe(true);
    for (const phrase of expected) {
      expect(output.output).toContain(phrase);
    }
  });

  it("validates exactly one next action", () => {
    const result = validateModeOutput("project_control", [
      "## Verdict",
      "- Not proven.",
      "## Verified",
      "- None.",
      "## Weak / Provisional",
      "- Codex says tests passed.",
      "## Unverified",
      "- Tests passed.",
      "## Risk",
      "- Fake-complete.",
      "## One Next Action",
      "- Run npm test.",
      "- Then run npm run build.",
      "## Codex Prompt if needed",
      "None."
    ].join("\n"));

    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toContain("exactly one next action");
  });
});
