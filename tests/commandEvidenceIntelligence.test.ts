import { describe, expect, it } from "vitest";
import {
  classifyCommandEvidence,
  commandFamilyForIntelligence,
  loadCommandEvidenceFixtureCases
} from "../src/evidence/CommandEvidenceIntelligence.js";

describe("command evidence intelligence", () => {
  it("classifies command families used by messy repo proof loops", () => {
    expect(commandFamilyForIntelligence("npm run typecheck")).toBe("typecheck");
    expect(commandFamilyForIntelligence("npm run audit:security")).toBe("lint");
    expect(commandFamilyForIntelligence("npm run audit:all-strengthened")).toBe("lint");
    expect(commandFamilyForIntelligence("pnpm vitest run")).toBe("test");
    expect(commandFamilyForIntelligence("./node_modules/.bin/tsx --test scripts/tests/project-manifest-policy.test.ts")).toBe("test");
    expect(commandFamilyForIntelligence("yarn jest --runInBand")).toBe("test");
    expect(commandFamilyForIntelligence("pytest tests/test_cli.py")).toBe("test");
    expect(commandFamilyForIntelligence("cargo test -p stax")).toBe("test");
    expect(commandFamilyForIntelligence("go test ./...")).toBe("test");
    expect(commandFamilyForIntelligence("./gradlew test")).toBe("test");
    expect(commandFamilyForIntelligence("./mvnw test")).toBe("test");
    expect(commandFamilyForIntelligence("bundle exec rspec spec/runtime_spec.rb")).toBe("test");
    expect(commandFamilyForIntelligence("composer test")).toBe("test");
    expect(commandFamilyForIntelligence("npm test")).toBe("test");
    expect(commandFamilyForIntelligence("npm run test:learning")).toBe("test");
    expect(commandFamilyForIntelligence("npm run test:metadata-policy")).toBe("test");
    expect(commandFamilyForIntelligence("npm run validate:manifests")).toBe("test");
    expect(commandFamilyForIntelligence("npm run verify -- --project social-studies-10-1-docx-export")).toBe("test");
    expect(commandFamilyForIntelligence("/opt/python/bin/python3 scripts/tests/brightspace_docx_style_profile_test.py")).toBe("test");
    expect(commandFamilyForIntelligence("python3 -m py_compile scripts/brightspace_zip_to_docx_upload_package.py")).toBe("typecheck");
    expect(commandFamilyForIntelligence("npm run test:e2e")).toBe("e2e");
    expect(commandFamilyForIntelligence("npm run build")).toBe("build");
    expect(commandFamilyForIntelligence("npm run smoke:stax")).toBe("test");
    expect(commandFamilyForIntelligence("npx vite-node --script scripts/send-cartridge-qti-google-visual-batch.ts -- --dry-run")).toBe("e2e");
    expect(commandFamilyForIntelligence("npm run brightspaceexport -- convert quiz.pdf --target msforms")).toBe("e2e");
    expect(commandFamilyForIntelligence("npm run rax -- eval --redteam")).toBe("redteam");
    expect(commandFamilyForIntelligence("npm run campaign:operating-window:today")).toBe("eval");
    expect(commandFamilyForIntelligence("gh run view 200")).toBe("ci");
    expect(commandFamilyForIntelligence("SYNC_ALL.cmd")).toBe("deploy");
  });

  it("keeps the 100-case command evidence fixture gate live", async () => {
    const cases = await loadCommandEvidenceFixtureCases();
    expect(cases).toHaveLength(200);
  });

  it("classifies proof strength across the fixture suite", async () => {
    const cases = await loadCommandEvidenceFixtureCases();
    const results = cases.map((testCase) => ({
      testCase,
      result: classifyCommandEvidence(testCase)
    }));
    const exactMatches = results.filter(({ testCase, result }) =>
      result.proofStrength === testCase.expectedProofStrength
    );
    const accuracy = exactMatches.length / results.length;

    expect(accuracy).toBeGreaterThanOrEqual(0.92);
    for (const { testCase, result } of results) {
      expect(result.proofStrength, testCase.caseId).toBe(testCase.expectedProofStrength);
      if (testCase.expectedStatus) {
        expect(result.status, testCase.caseId).toBe(testCase.expectedStatus);
      }
      if (testCase.expectedFamily) {
        expect(result.commandFamily, testCase.caseId).toBe(testCase.expectedFamily);
      }
    }
  });

  it("has zero critical false accepts and stays within false-block budget", async () => {
    const cases = await loadCommandEvidenceFixtureCases();
    const results = cases.map((testCase) => ({
      testCase,
      result: classifyCommandEvidence(testCase)
    }));

    const falseAccepts = results.filter(({ testCase, result }) =>
      !testCase.shouldBeStrong && result.proofStrength === "strong_local_proof"
    );
    expect(falseAccepts.map(({ testCase }) => testCase.caseId)).toEqual([]);

    const strongCases = results.filter(({ testCase }) => testCase.shouldBeStrong);
    const falseBlocks = strongCases.filter(({ result }) => result.proofStrength !== "strong_local_proof");
    const falseBlockRate = falseBlocks.length / strongCases.length;
    expect(falseBlockRate).toBeLessThanOrEqual(0.12);
  });

  it("explains why wrong-repo command output is not proof", () => {
    const result = classifyCommandEvidence({
      command: "npm test",
      cwd: "/repos/stax",
      repo: "STAX",
      branch: "main",
      commitSha: "local",
      exitCode: 0,
      finishedAt: "2026-05-02T19:00:00.000Z",
      source: "local_stax_command_output",
      output: "Tests passed",
      expectedRepo: "canvas-helper",
      expectedBranch: "main",
      claimType: "tests_passed"
    });

    expect(result.proofStrength).toBe("wrong_repo_proof");
    expect(result.limitations.join(" ")).toContain("wrong repo");
  });

  it("classifies successful github actions evidence as ci_proof instead of local proof", () => {
    const result = classifyCommandEvidence({
      command: "gh run view 200 --log",
      repo: "/Users/deanguedo/Documents/GitHub/STAX",
      branch: "main",
      commitSha: "abcdef1",
      exitCode: 0,
      source: "ci_workflow_output",
      output: "workflow completed successfully\nconclusion: success\nall checks passed",
      expectedRepo: "/Users/deanguedo/Documents/GitHub/STAX",
      expectedBranch: "main",
      expectedCommitSha: "abcdef1",
      claimType: "tests_passed"
    });

    expect(result.proofStrength).toBe("ci_proof");
    expect(result.status).toBe("passed");
  });

  it("treats repo exporter dry runs as executable local proof", () => {
    const result = classifyCommandEvidence({
      command: "cmd.exe /d /s /c npx vite-node --script scripts/send-cartridge-qti-google-visual-batch.ts -- --cartridge course.zip --include-choices-in-image --max-questions-per-form 25 --dry-run",
      cwd: "C:\\Users\\dean.guedo\\Documents\\GitHub\\brightspacequizexporter",
      repo: "brightspacequizexporter",
      branch: "codex/resume-math30-msforms-20260506",
      commitSha: "abcdef1",
      exitCode: 0,
      source: "local_stax_command_output",
      output: [
        "START\t1/2\titems=25\tModule 1 Assessment",
        "SUCCESS\t1/2\tModule 1 Assessment",
        "START\t2/2\titems=23\tModule 2 Assessment",
        "SUCCESS\t2/2\tModule 2 Assessment",
        "SUMMARY\t2\t0\tC:\\tmp\\summary.md"
      ].join("\n"),
      expectedRepo: "brightspacequizexporter",
      expectedBranch: "codex/resume-math30-msforms-20260506",
      expectedCommitSha: "abcdef1",
      claimType: "behavior"
    });

    expect(result.commandFamily).toBe("e2e");
    expect(result.proofStrength).toBe("strong_local_proof");
    expect(result.status).toBe("passed");
  });

  it("treats the Brightspace exporter command as executable local proof even when it writes artifacts silently", () => {
    const result = classifyCommandEvidence({
      command: "npm run brightspaceexport -- convert fixtures/benchmarks/sources/FINAL EXAM FORENSICS 25.pdf --target msforms --math hybrid --diagram-mode flag --output-dir tmp/export",
      cwd: "/Users/deanguedo/Documents/GitHub/brightspacequizexporter",
      repo: "brightspacequizexporter",
      branch: "codex/resume-math30-msforms-20260506",
      commitSha: "abcdef1",
      exitCode: 0,
      source: "local_stax_command_output",
      output: "",
      expectedRepo: "brightspacequizexporter",
      expectedBranch: "codex/resume-math30-msforms-20260506",
      expectedCommitSha: "abcdef1",
      claimType: "behavior"
    });

    expect(result.commandFamily).toBe("e2e");
    expect(result.proofStrength).toBe("strong_local_proof");
    expect(result.status).toBe("passed");
  });

  it("treats npm run test:* package scripts as executable local proof", () => {
    const result = classifyCommandEvidence({
      command: "npm run test:learning",
      cwd: "/Users/deanguedo/Documents/GitHub/canvas-helper",
      repo: "canvas-helper",
      branch: "main",
      commitSha: "abcdef1",
      exitCode: 0,
      source: "local_stax_command_output",
      output: "",
      expectedRepo: "canvas-helper",
      expectedBranch: "main",
      expectedCommitSha: "abcdef1",
      claimType: "tests_passed"
    });

    expect(result.commandFamily).toBe("test");
    expect(result.proofStrength).toBe("strong_local_proof");
    expect(result.status).toBe("passed");
  });

  it("does not treat zero skipped/todo/cancelled test-summary counts as partial command output", () => {
    const result = classifyCommandEvidence({
      command: "npm run test:e2e:harness",
      cwd: "/Users/deanguedo/Documents/GitHub/canvas-helper",
      repo: "canvas-helper",
      branch: "main",
      commitSha: "abcdef1",
      exitCode: 0,
      source: "local_stax_command_output",
      output: [
        "Test Files  1 passed (1)",
        "Tests  8 passed (8)",
        "Start at  19:24:24",
        "Duration  6.12s",
        "skipped 0",
        "todo 0",
        "cancelled 0"
      ].join("\n"),
      expectedRepo: "canvas-helper",
      expectedBranch: "main",
      expectedCommitSha: "abcdef1",
      claimType: "behavior"
    });

    expect(result.commandFamily).toBe("e2e");
    expect(result.proofStrength).toBe("strong_local_proof");
    expect(result.status).toBe("passed");
    expect(result.limitations).not.toContain("command or workflow was cancelled");
    expect(result.limitations).not.toContain("command output is partial, skipped, or incomplete");
  });

  it("does not treat explicit no-error summaries as failed proof", () => {
    const result = classifyCommandEvidence({
      command: "npm run verify -- --project social-studies-10-1-docx-export",
      cwd: "/Users/deanguedo/Documents/GitHub/canvas-helper",
      repo: "canvas-helper",
      branch: "main",
      commitSha: "abcdef1",
      exitCode: 0,
      source: "local_stax_command_output",
      output: [
        "Metadata policy: passed",
        "Mode: generated-output",
        "Missing generated outputs (ERROR): none"
      ].join("\n"),
      expectedRepo: "canvas-helper",
      expectedBranch: "main",
      expectedCommitSha: "abcdef1",
      claimType: "behavior"
    });

    expect(result.commandFamily).toBe("test");
    expect(result.proofStrength).toBe("strong_local_proof");
    expect(result.status).toBe("passed");
  });

  it("treats direct Python test scripts as executable local test proof", () => {
    const result = classifyCommandEvidence({
      command: "/opt/python/bin/python3 scripts/tests/brightspace_docx_style_profile_test.py",
      cwd: "/Users/deanguedo/Documents/GitHub/canvas-helper",
      repo: "canvas-helper",
      branch: "main",
      commitSha: "abcdef1",
      exitCode: 0,
      source: "local_stax_command_output",
      output: "Ran 3 tests in 0.000s\n\nOK",
      expectedRepo: "canvas-helper",
      expectedBranch: "main",
      expectedCommitSha: "abcdef1",
      claimType: "tests_passed"
    });

    expect(result.commandFamily).toBe("test");
    expect(result.proofStrength).toBe("strong_local_proof");
    expect(result.status).toBe("passed");
  });

  it("treats Python py_compile as executable typecheck proof", () => {
    const result = classifyCommandEvidence({
      command: "/opt/python/bin/python3 -m py_compile scripts/brightspace_zip_to_docx_upload_package.py",
      cwd: "/Users/deanguedo/Documents/GitHub/canvas-helper",
      repo: "canvas-helper",
      branch: "main",
      commitSha: "abcdef1",
      exitCode: 0,
      source: "local_stax_command_output",
      output: "",
      expectedRepo: "canvas-helper",
      expectedBranch: "main",
      expectedCommitSha: "abcdef1",
      claimType: "typecheck_passed"
    });

    expect(result.commandFamily).toBe("typecheck");
    expect(result.proofStrength).toBe("strong_local_proof");
    expect(result.status).toBe("passed");
  });

  it("does not treat passing regression eval case text about failures as failed proof", () => {
    const result = classifyCommandEvidence({
      command: "npm run rax -- eval --regression",
      cwd: "/Users/deanguedo/Documents/GitHub/STAX",
      repo: "STAX",
      branch: "main",
      commitSha: "abcdef1",
      exitCode: 0,
      source: "local_stax_command_output",
      output: JSON.stringify(
        {
          total: 49,
          passed: 49,
          failed: 0,
          passRate: 1,
          criticalFailures: 0,
          results: [
            {
              name: "strategy_mode_requires_kill_criteria",
              status: "pass",
              actual: "Red-Team Failure Modes: could overfit without proof.",
              failReasons: [],
              critical: true
            }
          ]
        },
        null,
        2
      ),
      expectedRepo: "STAX",
      expectedBranch: "main",
      expectedCommitSha: "abcdef1",
      claimType: "behavior"
    });

    expect(result.commandFamily).toBe("regression");
    expect(result.proofStrength).toBe("strong_local_proof");
    expect(result.status).toBe("passed");
  });

  it("does not treat passing eval case text about skipped tests as partial proof", () => {
    const result = classifyCommandEvidence({
      command: "npm run rax -- eval",
      cwd: "/Users/deanguedo/Documents/GitHub/STAX",
      repo: "STAX",
      branch: "main",
      commitSha: "abcdef1",
      exitCode: 0,
      source: "local_stax_command_output",
      output: JSON.stringify(
        {
          total: 16,
          passed: 16,
          failed: 0,
          passRate: 1,
          criticalFailures: 0,
          results: [
            {
              name: "planning_case",
              status: "pass",
              actual: "Rollback Plan: keep new tests as skipped only if they document an accepted gap.",
              failReasons: [],
              critical: false
            }
          ]
        },
        null,
        2
      ),
      expectedRepo: "STAX",
      expectedBranch: "main",
      expectedCommitSha: "abcdef1",
      claimType: "behavior"
    });

    expect(result.commandFamily).toBe("eval");
    expect(result.proofStrength).toBe("strong_local_proof");
    expect(result.status).toBe("passed");
    expect(result.limitations).not.toContain("command output is partial, skipped, or incomplete");
  });

  it("still flags positive skipped/todo/cancelled command-summary counts", () => {
    const result = classifyCommandEvidence({
      command: "npm run test:e2e:harness",
      cwd: "/Users/deanguedo/Documents/GitHub/canvas-helper",
      repo: "canvas-helper",
      branch: "main",
      commitSha: "abcdef1",
      exitCode: 0,
      source: "local_stax_command_output",
      output: [
        "Test Files  1 passed (1)",
        "Tests  7 passed | skipped 1 | todo 1 | cancelled 1"
      ].join("\n"),
      expectedRepo: "canvas-helper",
      expectedBranch: "main",
      expectedCommitSha: "abcdef1",
      claimType: "behavior"
    });

    expect(result.proofStrength).toBe("partial_local_proof");
    expect(result.status).toBe("partial");
    expect(result.limitations).toContain("command or workflow was cancelled");
  });
});
