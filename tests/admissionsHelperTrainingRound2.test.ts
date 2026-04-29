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
    expectedHeadings?: string[];
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

  const mandatorySections = assertions.expectedHeadings ?? ["verified", "weak / provisional", "unverified", "risk", "one next action"];
  for (const heading of mandatorySections) {
    expect(normalizedOutput).toContain(`## ${heading.toLowerCase()}`);
  }

  const weakSection = sectionText(output.output, "Weak / Provisional");
  const verifiedSection = sectionText(output.output, "Verified");
  expect(verifiedSection).toBeTruthy();
  expect(weakSection).toBeTruthy();
}

type ManualBenchmarkCase = {
  caseId: string;
  task: string;
  repoEvidence: string;
  commandEvidence: string;
  codexReport: string;
  expectedBestTraits?: string[];
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

describe("ADMISSION-APP training benchmark (round-2 batch)", () => {
  const trainingCases = [
    {
      caseId: "round2_explicit_stax_provider_backed_audit_001",
      caseMustContain: ["stax", "evidence", "diff", "command"],
      nextActionMustContain: ["local evidence", "relevant diff", "exact command output"]
    },
    {
      caseId: "round2_explicit_brightspace_rollup_gate_002",
      caseMustContain: ["ingest", "npm run ingest:ci", "brightspacequizexporter"],
      nextActionMustContain: ["/users/deanguedo/documents/github/brightspacequizexporter", "npm run ingest:ci"]
    },
    {
      caseId: "round2_explicit_admission_pages_build_003",
      caseMustContain: ["admission", "build:pages"],
      nextActionMustContain: ["npm run build:pages"],
      nextActionMustAvoid: ["publish", "create test"]
    },
    {
      caseId: "round2_explicit_canvas_visual_004",
      caseMustContain: ["sports wellness", "rendered", "screenshot"],
      nextActionMustContain: ["screenshot", "rendered"],
      nextActionMustAvoid: ["css only", "source only"]
    },
    {
      caseId: "round2_explicit_admission_sheets_preflight_005",
      caseMustContain: ["sheets", "preflight", "target", "read-only"],
      nextActionMustContain: ["inspect", "before any", "publish command"],
      nextActionMustAvoid: ["publish now", "run sync"]
    },
    {
      caseId: "round2_explicit_stax_memory_approval_006",
      caseMustContain: ["memory", "approved", "approval"],
      nextActionMustContain: ["pending review", "approvedby", "approvalreason", "poison-scan"],
      nextActionMustAvoid: ["auto-save", "auto save", "silent approval"]
    },
    {
      caseId: "round2_explicit_brightspace_dependency_scope_007",
      caseMustContain: ["dependency", "scope", "package-lock", "rollup"],
      nextActionMustContain: ["revert", "package-lock", "npm ls", "npm run ingest:ci"],
      nextActionMustAvoid: ["ingest:seed-gold", "seed-gold"]
    },
    {
      caseId: "round2_explicit_admission_pipeline_publish_008",
      caseMustContain: ["pipeline", "publish", "qa", "row-count"],
      nextActionMustContain: ["pipeline/check_ualberta_url_map_fixtures.py", "dry-run", "validation"],
      nextActionMustAvoid: ["publish now", "push", "deploy"]
    },
    {
      caseId: "round2_explicit_canvas_script_build_009",
      caseMustContain: ["build", "script", "output"],
      nextActionMustContain: ["npm run build:studio", "exact output"],
      nextActionMustAvoid: ["source file", "script exists", "already proven"]
    },
    {
      caseId: "round2_explicit_stax_human_pasted_010",
      caseMustContain: ["human-pasted", "weak", "local command evidence"],
      nextActionMustContain: ["rerun npm test", "exact command output", "exit code"],
      nextActionMustAvoid: ["safe to claim passed", "already proven"]
    }
  ];

  trainingCases.forEach((trainingCase) => {
    it(`enforces training behavior for ${trainingCase.caseId}`, async () => {
      const fixtureCase = loadCaseById("stax_vs_raw_chatgpt_round2_repo_targeting_cases.json", trainingCase.caseId);
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
