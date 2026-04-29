import fs from "node:fs";
import path from "node:path";
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

function sectionText(output: string, heading: string): string {
  const pattern = new RegExp(`^##\\s+${heading}\\n([\\s\\S]*?)(\\n##\\s+|$)`, "m");
  const match = pattern.exec(output);
  return match?.[1]?.toLowerCase() ?? "";
}

function assertCaseOutput(
  output: { output: string; validation: { valid: boolean }; taskMode: string },
  assertions: {
    caseMustContain: string[];
    nextActionMustContain: string[];
    nextActionMustAvoid?: string[];
  }
): void {
  const normalizedOutput = output.output.toLowerCase();

  expect(output.taskMode).toBe("project_control");
  expect(output.validation.valid).toBe(true);
  expect(validateModeOutput("project_control", output.output).valid).toBe(true);

  for (const phrase of assertions.caseMustContain) {
    expect(normalizedOutput).toContain(phrase.toLowerCase());
  }

  const nextActionSection = sectionText(output.output, "One Next Action");
  expect(nextActionSection).toBeTruthy();

  for (const phrase of assertions.nextActionMustContain) {
    expect(nextActionSection).toContain(phrase.toLowerCase());
  }

  for (const phrase of assertions.nextActionMustAvoid ?? []) {
    expect(nextActionSection).not.toContain(phrase.toLowerCase());
  }

  const weakSection = sectionText(output.output, "Weak / Provisional");
  const verifiedSection = sectionText(output.output, "Verified");
  expect(verifiedSection).toBeTruthy();
  expect(weakSection).toBeTruthy();

  expect(nextActionSection).toMatch(/\b(run|ask|inspect|identify|check|capture|report|complete)\b/);

  const mandatorySections = ["verified", "weak / provisional", "unverified", "risk", "one next action"];
  for (const heading of mandatorySections) {
    expect(normalizedOutput).toContain(`## ${heading.toLowerCase()}`);
  }
}

type ManualBenchmarkCase = {
  caseId: string;
  task: string;
  repoEvidence: string;
  commandEvidence: string;
  codexReport: string;
};

type ManualBenchmarkFixture = {
  cases: ManualBenchmarkCase[];
};

function loadCaseById(fileName: string, caseId: string): ManualBenchmarkCase {
  const fixturePath = path.join(process.cwd(), "fixtures/manual_benchmark", fileName);
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as ManualBenchmarkFixture;
  const found = fixture.cases.find((candidate) => candidate.caseId === caseId);

  if (!found) {
    throw new Error(`Case ${caseId} missing from ${fileName}`);
  }

  return found;
}

describe("ADMISSION-APP training benchmark (10 cases)", () => {
  const trainingCases = [
    {
      caseId: "manual_admission_build_pages_no_output_006",
      caseMustContain: [
        "script existence",
        "npm run build:pages",
        "no local command output"
      ],
      nextActionMustContain: ["npm run build:pages"],
      nextActionMustAvoid: ["publish"]
    },
    {
      caseId: "manual_admission_ios_release_gate_007",
      caseMustContain: [
        "not release-ready",
        "mobile/ios-wrapper",
        "npm run preflight"
      ],
      nextActionMustContain: ["mobile/ios-wrapper", "npm run preflight"],
      nextActionMustAvoid: ["submit", "publish"]
    },
    {
      caseId: "manual_admission_sheets_sync_boundary_008",
      caseMustContain: [
        "sheets",
        "safety",
        "target"
      ],
      nextActionMustContain: ["inspect", "target", "validation"],
      nextActionMustAvoid: ["run sync_all", "run sync:all.cmd"]
    },
    {
      caseId: "manual_admission_ualberta_fixture_claim_009",
      caseMustContain: [
        "fixture",
        "check_ualberta_url_map_fixtures.py",
        "pipeline support"
      ],
      nextActionMustContain: ["python pipeline/check_ualberta_url_map_fixtures.py"],
      nextActionMustAvoid: ["done", "complete"]
    },
    {
      caseId: "manual_admission_avg_total_dry_run_010",
      caseMustContain: [
        "dry run",
        "avg_total"
      ],
      nextActionMustContain: ["dry", "avg_total_candidates"],
      nextActionMustAvoid: ["apply directly", "canonical"]
    },
    {
      caseId: "manual_admission_webapp_visual_claim_011",
      caseMustContain: [
        "visual",
        "screenshot",
        "checklist"
      ],
      nextActionMustContain: ["capture rendered web app evidence", "checklist"],
      nextActionMustAvoid: ["css", "source"]
    },
    {
      caseId: "manual_admission_apps_script_structure_012",
      caseMustContain: [
        "apps script structure",
        "validation",
        "discover the exact"
      ],
      nextActionMustContain: ["discover", "run"],
      nextActionMustAvoid: ["do a deploy"]
    },
    {
      caseId: "manual_admission_pipeline_publish_claim_020",
      caseMustContain: [
        "pipeline",
        "validate-canonical.ps1",
        "qa"
      ],
      nextActionMustContain: ["validate-canonical.ps1", "row-count"],
      nextActionMustAvoid: ["publish now", "push"]
    },
    {
      caseId: "round2_withheld_admission_avg_total_012",
      caseMustContain: [
        "repo path is withheld",
        "do not apply canonical data changes",
        "ask"
      ],
      nextActionMustContain: ["repo path", "dry"],
      nextActionMustAvoid: []
    },
    {
      caseId: "round2_misleading_admission_task_stax_path_016",
      caseMustContain: [
        "/users/deanguedo/documents/github/admission-app",
        "wrong repo",
        "ignore",
        "work only"
      ],
      nextActionMustContain: ["admission", "publish decision"],
      nextActionMustAvoid: ["publish now", "run from"]
    }
  ];

  trainingCases.forEach((trainingCase) => {
    it(`enforces training behavior for ${trainingCase.caseId}`, async () => {
      const fixtureCase = loadCaseById(
        trainingCase.caseId.startsWith("manual_")
          ? "stax_vs_chatgpt_seed_20_cases.json"
          : "stax_vs_raw_chatgpt_round2_repo_targeting_cases.json",
        trainingCase.caseId
      );

      const runtime = await createDefaultRuntime();
      const response = await runtime.run(
        benchmarkPrompt({
          task: fixtureCase.task,
          repoEvidence: fixtureCase.repoEvidence,
          commandEvidence: fixtureCase.commandEvidence,
          codexReport: fixtureCase.codexReport
        })
      );

      assertCaseOutput(response, {
        caseMustContain: trainingCase.caseMustContain,
        nextActionMustContain: trainingCase.nextActionMustContain,
        nextActionMustAvoid: trainingCase.nextActionMustAvoid
      });
    });
  });
});
