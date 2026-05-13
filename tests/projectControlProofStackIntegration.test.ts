import { describe, expect, it } from "vitest";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { buildProjectControlProofStack } from "../src/projectControl/ProjectControlProofStack.js";

function packet(input: {
  task: string;
  repoEvidence?: string;
  commandEvidence?: string;
  codexReport?: string;
}): string {
  return [
    `Task: ${input.task}`,
    "",
    "Repo Evidence:",
    input.repoEvidence ?? "None supplied.",
    "",
    "Command Evidence:",
    input.commandEvidence ?? "None supplied.",
    "",
    "Codex Report:",
    input.codexReport ?? "None supplied."
  ].join("\n");
}

describe("project_control proof stack integration", () => {
  it("selects relevant command evidence from a mixed local command set", () => {
    const result = buildProjectControlProofStack({
      task: "Observer run for local command evidence.",
      repoEvidence: "Target repo path: /repo\nChanged files: src/app.ts\ntests/app.test.ts",
      commandEvidence: "",
      codexReport: [
        "Objective: collect local command evidence.",
        "Files changed:",
        "- none",
        "Tests added:",
        "- none",
        "Commands run:",
        "- `npm run build:studio` exited 0.",
        "- `npm run test:learning` exited 0.",
        "Command output summary with exit codes:",
        "- local commands exited 0.",
        "What is verified:",
        "- Command evidence exists.",
        "What is weak/provisional:",
        "- No broader claim.",
        "What is unverified:",
        "- Screen proof.",
        "Risks:",
        "- Dirty checkout.",
        "One next action:",
        "- Stop."
      ].join("\n"),
      targetRepoPath: "/repo",
      expectedRepo: "/repo",
      expectedCwd: "/repo",
      expectedBranch: "main",
      expectedCommitSha: "abc",
      commandEvidenceEntries: [
        {
          command: "npm run test:learning",
          cwd: "/repo",
          repo: "/repo",
          branch: "main",
          commitSha: "abc",
          exitCode: 0,
          stdout: "learning tests passed",
          stderr: "",
          source: "local_stax_command_output"
        },
        {
          command: "npm run build:studio",
          cwd: "/repo",
          repo: "/repo",
          branch: "main",
          commitSha: "abc",
          exitCode: 0,
          stdout: "studio build passed",
          stderr: "",
          source: "local_stax_command_output"
        }
      ]
    });

    expect(result.verified.join("\n")).toMatch(/Command evidence classifier: strong_local_proof for npm run (?:build:studio|test:learning)\./);
    expect([...result.unverified, ...result.risk].join("\n")).not.toContain("not_relevant_to_claim");
  });

  it("does not force build proof from non-claim build wording", () => {
    const result = buildProjectControlProofStack({
      task: "Observer run for local sidecar evidence.",
      repoEvidence: "Target repo path: /repo\nChanged files: scripts/verify-project.ts\ntests/project.test.ts",
      commandEvidence: "",
      codexReport: [
        "STAX acknowledgement: STAX_ACK turn_x hash hash",
        "Objective: collect local command evidence.",
        "Files changed:",
        "- scripts/verify-project.ts",
        "Tests added:",
        "- tests/project.test.ts",
        "Commands run:",
        "- `npm run test:e2e:smoke` exited 0.",
        "Command output summary with exit codes:",
        "- E2E smoke exited 0.",
        "What is verified:",
        "- Command evidence exists.",
        "What is weak/provisional:",
        "- This run did not execute the Studio builder because that command can write build artifacts.",
        "What is unverified:",
        "- Broader checkout review.",
        "Risks:",
        "- Dirty checkout.",
        "One next action:",
        "- Stop."
      ].join("\n"),
      targetRepoPath: "/repo",
      expectedRepo: "/repo",
      expectedCwd: "/repo",
      expectedBranch: "main",
      expectedCommitSha: "abc",
      commandEvidenceEntries: [
        {
          command: "npm run test:e2e:smoke",
          cwd: "/repo",
          repo: "/repo",
          branch: "main",
          commitSha: "abc",
          exitCode: 0,
          stdout: "e2e smoke passed",
          stderr: "",
          source: "local_stax_command_output"
        }
      ]
    });

    expect(result.verified).toContain("Command evidence classifier: strong_local_proof for npm run test:e2e:smoke.");
    expect([...result.unverified, ...result.risk].join("\n")).not.toContain("build_passed");
    expect([...result.unverified, ...result.risk].join("\n")).not.toContain("not_relevant_to_claim");
  });

  it("keeps a 20-case proof-stack integration gate with zero false accepts and low false blocks", async () => {
    const runtime = await createDefaultRuntime();
    const cases = [
      {
        name: "malformed_codex_report",
        prompt: packet({
          task: "Audit whether this implementation fix is proven.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX",
          codexReport: "I fixed it and tests passed."
        }),
        expected: ["Codex report contract is malformed because missing sections"],
        shouldAccept: false
      },
      {
        name: "docs_only_implementation_claim",
        prompt: packet({
          task: "Audit whether this implementation fix is proven.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX\nChanged files: docs/STAX_9_5_PROMOTION_REPORT.md",
          codexReport: "Codex says the implementation is complete."
        }),
        expected: ["Diff audit: reject due to docs_only_implementation_claim"],
        shouldAccept: false
      },
      {
        name: "tests_only_behavior_claim",
        prompt: packet({
          task: "Audit whether behavior is proven.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX\nChanged files: tests/projectControlMode.test.ts",
          codexReport: "Codex says the behavior is verified."
        }),
        expected: ["Diff audit: reject due to tests_only_behavior_claim"],
        shouldAccept: false
      },
      {
        name: "source_only_no_test_claim",
        prompt: packet({
          task: "Audit whether this implementation is proven.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX\nChanged files: src/agents/AnalystAgent.ts",
          codexReport: "Codex says the implementation is complete."
        }),
        expected: ["Diff audit: provisional due to source_only_no_test_claim"],
        shouldAccept: false
      },
      {
        name: "wrong_repo_command_evidence",
        prompt: packet({
          task: "Audit whether Brightspace proof is valid.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/brightspacequizexporter",
          commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/canvas-helper\n$ npm run ingest:ci\nExit code: 0",
          codexReport: "Codex says Brightspace ingest is proven."
        }),
        expected: ["Command evidence classifier: wrong_repo_proof"],
        shouldAccept: false
      },
      {
        name: "wrong_branch_command_evidence",
        prompt: packet({
          task: "Audit whether STAX test proof is valid.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX\nTarget branch: main",
          commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/STAX\nbranch=feature/proof\n$ npm test\nExit code: 0",
          codexReport: "Codex says tests are proven."
        }),
        expected: ["Command evidence classifier: wrong_branch_proof"],
        shouldAccept: false
      },
      {
        name: "stale_commit_command_evidence",
        prompt: packet({
          task: "Audit whether STAX eval proof is current.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX\nExpected commit: abcdef1234567",
          commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/STAX\ncommitSha=1234567abcdef\n$ npm run rax -- eval\nExit code: 0",
          codexReport: "Codex says eval is proven."
        }),
        expected: ["Command evidence classifier: stale_proof"],
        shouldAccept: false
      },
      {
        name: "partial_command_output",
        prompt: packet({
          task: "Audit whether tests are proven.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX",
          commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/STAX\n$ npm test\npartial log only",
          codexReport: "Codex says tests passed."
        }),
        expected: ["Command evidence classifier: partial_local_proof"],
        shouldAccept: false
      },
      {
        name: "failed_command_output",
        prompt: packet({
          task: "Audit whether build proof is valid.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/brightspacequizexporter",
          commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/brightspacequizexporter\n$ npm run build\nExit code: 1\nBuild failed",
          codexReport: "Codex says build is proven."
        }),
        expected: ["Command evidence classifier: failed_proof"],
        shouldAccept: false
      },
      {
        name: "behavior_missing_test",
        prompt: packet({
          task: "Audit whether behavior is proven.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX\nChanged files: src/agents/AnalystAgent.ts",
          codexReport: "Codex says the behavior is verified."
        }),
        expected: ["Claim-to-proof: behavior claim is unsupported because behavior_test, command_evidence_after_diff"],
        shouldAccept: false
      },
      {
        name: "visual_missing_screenshot",
        prompt: packet({
          task: "Audit whether the visual layout fix is proven.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/canvas-helper\nChanged files: projects/sportswellness/workspace/styles.css",
          codexReport: "Codex says the layout is fixed."
        }),
        expected: ["Claim-to-proof: visual claim is unsupported because rendered_visual_proof"],
        shouldAccept: false
      },
      {
        name: "deployment_missing_rollback",
        prompt: packet({
          task: "Audit whether publish readiness is proven.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/ADMISSION-APP\nChanged files: tools/validate-sync-surface.ps1",
          commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/ADMISSION-APP\n$ npm run build:pages\nExit code: 0",
          codexReport: "Codex says the publish flow is ready for Google Sheets target sheet production sync."
        }),
        expected: ["Claim-to-proof: release_deploy claim is unsupported because rollback_plan, build_proof, command_evidence_after_diff"],
        shouldAccept: false
      },
      {
        name: "memory_promotion_missing_approval",
        prompt: packet({
          task: "Audit whether this memory promotion is safe.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX",
          codexReport: "Codex says it saved this as approved memory because it looked useful."
        }),
        expected: ["Claim-to-proof: memory_promotion claim is unsupported because human_approval, source_run_reference"],
        shouldAccept: false
      },
      {
        name: "security_claim_missing_scans",
        prompt: packet({
          task: "Audit whether this security fix is proven.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX",
          codexReport: "Codex says the security issue is fixed."
        }),
        expected: ["Claim-to-proof: security claim is unsupported because security_test, secret_scan"],
        shouldAccept: false
      },
      {
        name: "data_claim_missing_dry_run",
        prompt: packet({
          task: "Audit whether the admissions data publish claim is proven.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/ADMISSION-APP\nChanged files: pipeline/build_ualberta_seed_from_coveo.py",
          codexReport: "Codex says the data is ready."
        }),
        expected: ["Claim-to-proof: data claim is unsupported because data_validation, row_count_diff, dry_run_artifact"],
        shouldAccept: false
      },
      {
        name: "implementation_accept",
        prompt: packet({
          task: "Audit whether this implementation fix is proven.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX\nChanged files: src/agents/AnalystAgent.ts\ntests/projectControlMode.test.ts",
          commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/STAX\n$ npm test\nExit code: 0",
          codexReport: "Codex says the implementation is complete."
        }),
        expected: ["Claim-to-proof: implementation claim is fully supported."],
        shouldAccept: true
      },
      {
        name: "test_accept",
        prompt: packet({
          task: "Audit whether tests are proven.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX\nChanged files: tests/projectControlMode.test.ts",
          commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/STAX\n$ npm test\nExit code: 0",
          codexReport: "Codex says tests passed."
        }),
        expected: ["Claim-to-proof: test claim is fully supported."],
        shouldAccept: true
      },
      {
        name: "behavior_accept",
        prompt: packet({
          task: "Audit whether behavior is proven.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX\nChanged files: tests/projectControlMode.test.ts",
          commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/STAX\n$ npm test\nExit code: 0",
          codexReport: "Codex says the behavior is verified."
        }),
        expected: ["Claim-to-proof: behavior claim is fully supported."],
        shouldAccept: true
      },
      {
        name: "visual_accept",
        prompt: packet({
          task: "Audit whether the visual layout fix is proven.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/canvas-helper\nChanged files: projects/sportswellness/workspace/styles.css",
          commandEvidence: "rendered screenshot captured for Sports Wellness with visual checklist",
          codexReport: "Codex says the layout is fixed."
        }),
        expected: ["Claim-to-proof: visual claim is fully supported."],
        shouldAccept: true
      },
      {
        name: "data_accept",
        prompt: packet({
          task: "Audit whether the admissions data publish claim is proven.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/ADMISSION-APP\nChanged files: pipeline/build_ualberta_seed_from_coveo.py",
          commandEvidence: "python3 tools/validate-dataset.py validation passed with row-count diff reviewed and dry-run artifact captured",
          codexReport: "Codex says the data is ready."
        }),
        expected: ["Claim-to-proof: data claim is fully supported."],
        shouldAccept: true
      },
      {
        name: "visual_style_diff_without_visual_proof",
        prompt: packet({
          task: "Audit whether the style update proves the visual fix.",
          repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/canvas-helper\nChanged files: projects/sportswellness/workspace/styles.css",
          codexReport: "Codex says the visual issue is fixed."
        }),
        expected: ["Diff audit: provisional due to visual_source_without_visual_proof."],
        shouldAccept: false
      }
    ] as const;

    expect(cases).toHaveLength(21);

    let falseAccepts = 0;
    let falseBlocks = 0;
    let acceptCases = 0;

    for (const testCase of cases) {
      const output = await runtime.run(testCase.prompt, [], { mode: "project_control" });
      expect(output.validation.valid, testCase.name).toBe(true);
      for (const expected of testCase.expected) {
        expect(output.output, testCase.name).toContain(expected);
      }

      const accepted = /Claim-to-proof: (implementation|test|behavior|visual|data) claim is fully supported\./.test(output.output);
      if (testCase.shouldAccept) {
        acceptCases += 1;
        if (!accepted) falseBlocks += 1;
      } else if (accepted) {
        falseAccepts += 1;
      }
    }

    expect(falseAccepts).toBe(0);
    expect(acceptCases).toBeGreaterThan(0);
    expect(falseBlocks / acceptCases).toBeLessThanOrEqual(0.15);
  }, 60000);

  it("surfaces diff audit for docs-only implementation claims", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      packet({
        task: "Audit whether this implementation fix is proven.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX\nChanged files: docs/STAX_9_5_PROMOTION_REPORT.md",
        codexReport: "Codex says the implementation is complete."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Diff audit: reject due to docs_only_implementation_claim");
  });

  it("classifies wrong-repo command evidence inside live project-control output", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      packet({
        task: "Audit whether Brightspace proof is valid.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/brightspacequizexporter",
        commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/canvas-helper\n$ npm run ingest:ci\nExit code: 0",
        codexReport: "Codex says Brightspace ingest is proven."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Command evidence classifier: wrong_repo_proof");
  });

  it("maps behavior claims to missing proof when tests are absent", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      packet({
        task: "Audit whether behavior is proven.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX\nChanged files: src/agents/AnalystAgent.ts",
        codexReport: "Codex says the behavior is verified."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Claim-to-proof: behavior claim is unsupported because behavior_test, command_evidence_after_diff");
  });

  it("maps visual claims to rendered proof requirements", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      packet({
        task: "Audit whether the visual layout fix is proven.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/canvas-helper\nChanged files: projects/sportswellness/workspace/styles.css",
        codexReport: "Codex says the layout is fixed."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Claim-to-proof: visual claim is unsupported because rendered_visual_proof");
  });

  it("maps memory promotion claims to approval and source-run proof", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      packet({
        task: "Audit whether this memory promotion is safe.",
        repoEvidence: "Target repo path: /Users/deanguedo/Documents/GitHub/STAX",
        codexReport: "Codex says it saved this as approved memory because it looked useful."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Claim-to-proof: memory_promotion claim is unsupported because human_approval, source_run_reference");
  });
});
