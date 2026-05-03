import { describe, expect, it } from "vitest";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import {
  parseProjectControlPacket,
  stringifyProjectControlEvidencePacket,
  type StructuredProjectControlEvidencePacket
} from "../src/projectControl/ProjectControlEvidencePacket.js";

function structuredPacket(overrides: Partial<StructuredProjectControlEvidencePacket>): string {
  return stringifyProjectControlEvidencePacket({
    task: "Audit whether this implementation fix is proven.",
    targetRepoPath: "/Users/deanguedo/Documents/GitHub/STAX",
    changedFiles: [],
    commandEvidence: [],
    codexReport: "",
    visualEvidence: [],
    dataProofArtifacts: [],
    releaseProofArtifacts: [],
    humanApproval: [],
    ...overrides
  });
}

describe("project control evidence packet", () => {
  it("parses a structured packet and preserves native evidence fields", () => {
    const packet = parseProjectControlPacket(
      structuredPacket({
        repo: "STAX",
        branch: "main",
        baseSha: "1111111",
        headSha: "2222222",
        gitStatusShort: "M src/agents/AnalystAgent.ts",
        changedFiles: [{ path: "src/agents/AnalystAgent.ts", changeType: "modified", fileRole: "source" }],
        commandEvidence: [
          {
            command: "npm test",
            cwd: "/Users/deanguedo/Documents/GitHub/STAX",
            repo: "/Users/deanguedo/Documents/GitHub/STAX",
            branch: "main",
            commitSha: "2222222",
            exitCode: 0,
            stdout: "tests passed",
            stderr: "",
            source: "local_stax_command_output"
          }
        ]
      })
    );

    expect(packet.structured?.branch).toBe("main");
    expect(packet.structured?.changedFiles[0]?.path).toBe("src/agents/AnalystAgent.ts");
    expect(packet.repoEvidence).toContain("Target branch: main");
    expect(packet.commandEvidence).toContain("$ npm test");
    expect(packet.commandEvidence).toContain("commitSha=2222222");
  });

  it("parses structured PR artifact packets and renders them into repo evidence", () => {
    const packet = parseProjectControlPacket(
      structuredPacket({
        repo: "STAX",
        pullRequestArtifact: {
          prNumber: 77,
          title: "Fix project-control proof packet handling",
          body: "Adds CI and review evidence.",
          repo: "/Users/deanguedo/Documents/GitHub/STAX",
          branch: "feature/pr-audit",
          commitSha: "abc7777",
          changedFiles: ["src/projectControl/ProjectControlEvidencePacket.ts"],
          ciStatuses: [
            {
              workflow: "test",
              status: "success",
              branch: "feature/pr-audit",
              commitSha: "abc7777",
              summary: "workflow completed successfully",
              failedJobCount: 0,
              cancelledJobCount: 0,
              skippedJobCount: 0
            }
          ],
          reviewComments: [],
          issueLinks: [],
          labels: ["project-control"]
        }
      })
    );

    expect(packet.structured?.pullRequestArtifact?.prNumber).toBe(77);
    expect(packet.repoEvidence).toContain("Pull request artifact: #77");
    expect(packet.repoEvidence).toContain("PR branch: feature/pr-audit");
  });

  it("adds a suggested PR comment when auditing a structured PR artifact packet", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      structuredPacket({
        task: "Audit whether this implementation fix is proven.",
        repo: "STAX",
        pullRequestArtifact: {
          prNumber: 61,
          title: "Tighten project-control validator",
          body: "Includes tests and proof notes.",
          repo: "/Users/deanguedo/Documents/GitHub/STAX",
          branch: "feature/pr-audit",
          commitSha: "abc9876",
          changedFiles: ["src/validators/ProjectControlValidator.ts", "tests/projectControlMode.test.ts"],
          ciStatuses: [],
          reviewComments: [{ body: "Please verify the edge case.", state: "open" }],
          issueLinks: [],
          labels: ["project-control"]
        }
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("## Suggested PR Comment");
    expect(output.output).toContain("This needs human review before approval");
  });

  it("still parses the legacy labeled text packet format", () => {
    const packet = parseProjectControlPacket([
      "Task: Audit whether tests are proven.",
      "",
      "Repo Evidence:",
      "Target repo path: /Users/deanguedo/Documents/GitHub/STAX",
      "",
      "Command Evidence:",
      "cwd=/Users/deanguedo/Documents/GitHub/STAX",
      "$ npm test",
      "Exit code: 0",
      "",
      "Codex Report:",
      "Codex says tests passed."
    ].join("\n"));

    expect(packet.structured).toBeUndefined();
    expect(packet.task).toContain("Audit whether tests are proven.");
    expect(packet.commandEvidence).toContain("$ npm test");
  });

  it("accepts structured source+test+fresh passing command evidence", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      structuredPacket({
        task: "Audit whether this implementation fix is proven.",
        repo: "STAX",
        branch: "main",
        baseSha: "1111111",
        headSha: "2222222",
        changedFiles: [
          { path: "src/agents/AnalystAgent.ts", changeType: "modified", fileRole: "source" },
          { path: "tests/projectControlMode.test.ts", changeType: "modified", fileRole: "test" }
        ],
        commandEvidence: [
          {
            command: "npm test",
            cwd: "/Users/deanguedo/Documents/GitHub/STAX",
            repo: "/Users/deanguedo/Documents/GitHub/STAX",
            branch: "main",
            commitSha: "2222222",
            exitCode: 0,
            stdout: "Test Files 130 passed",
            stderr: "",
            source: "local_stax_command_output"
          }
        ],
        codexReport: "Codex says the implementation is complete."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Claim-to-proof: implementation claim is fully supported.");
  });

  it("uses structured unified diff evidence instead of filename guesswork", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      structuredPacket({
        task: "Audit whether this implementation fix is proven.",
        repo: "STAX",
        branch: "main",
        baseSha: "1111111",
        headSha: "2222222",
        changedFiles: [],
        unifiedDiff: [
          "diff --git a/docs/runtime.md b/docs/runtime.md",
          "--- a/docs/runtime.md",
          "+++ b/docs/runtime.md",
          "@@ -1 +1 @@",
          "-old",
          "+new"
        ].join("\n"),
        codexReport: "Codex says the implementation is complete."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Diff audit: reject due to docs_only_implementation_claim");
  });

  it("rejects structured wrong-repo command evidence", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      structuredPacket({
        task: "Audit whether Brightspace proof is valid.",
        targetRepoPath: "/Users/deanguedo/Documents/GitHub/brightspacequizexporter",
        changedFiles: [{ path: "src/parser.ts", changeType: "modified", fileRole: "source" }],
        commandEvidence: [
          {
            command: "npm run ingest:ci",
            cwd: "/Users/deanguedo/Documents/GitHub/canvas-helper",
            repo: "/Users/deanguedo/Documents/GitHub/canvas-helper",
            branch: "main",
            commitSha: "2222222",
            exitCode: 0,
            stdout: "passed",
            stderr: "",
            source: "local_stax_command_output"
          }
        ],
        codexReport: "Codex says Brightspace ingest is proven."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Command evidence classifier: wrong_repo_proof");
  });

  it("rejects structured wrong-branch command evidence", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      structuredPacket({
        task: "Audit whether STAX test proof is valid.",
        targetRepoPath: "/Users/deanguedo/Documents/GitHub/STAX",
        branch: "main",
        changedFiles: [{ path: "tests/projectControlMode.test.ts", changeType: "modified", fileRole: "test" }],
        commandEvidence: [
          {
            command: "npm test",
            cwd: "/Users/deanguedo/Documents/GitHub/STAX",
            repo: "/Users/deanguedo/Documents/GitHub/STAX",
            branch: "feature/proof",
            commitSha: "2222222",
            exitCode: 0,
            stdout: "passed",
            stderr: "",
            source: "local_stax_command_output"
          }
        ],
        codexReport: "Codex says tests are proven."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Command evidence classifier: wrong_branch_proof");
  });

  it("rejects structured stale commit command evidence", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      structuredPacket({
        task: "Audit whether STAX eval proof is current.",
        targetRepoPath: "/Users/deanguedo/Documents/GitHub/STAX",
        headSha: "abcdef1234567",
        changedFiles: [{ path: "tests/projectControlMode.test.ts", changeType: "modified", fileRole: "test" }],
        commandEvidence: [
          {
            command: "npm run rax -- eval",
            cwd: "/Users/deanguedo/Documents/GitHub/STAX",
            repo: "/Users/deanguedo/Documents/GitHub/STAX",
            branch: "main",
            commitSha: "1234567abcdef",
            exitCode: 0,
            stdout: "passed",
            stderr: "",
            source: "local_stax_command_output"
          }
        ],
        codexReport: "Codex says eval is proven."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Command evidence classifier: stale_proof");
  });

  it("keeps visual/style structured packets provisional without visual evidence", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      structuredPacket({
        task: "Audit whether the visual layout fix is proven.",
        targetRepoPath: "/Users/deanguedo/Documents/GitHub/canvas-helper",
        changedFiles: [{ path: "projects/sportswellness/workspace/styles.css", changeType: "modified", fileRole: "visual_style" }],
        codexReport: "Codex says the layout is fixed."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Diff audit: provisional due to visual_source_without_visual_proof.");
  });

  it("accepts visual/style structured packets when visual evidence is present", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      structuredPacket({
        task: "Audit whether the visual layout fix is proven.",
        targetRepoPath: "/Users/deanguedo/Documents/GitHub/canvas-helper",
        changedFiles: [{ path: "projects/sportswellness/workspace/styles.css", changeType: "modified", fileRole: "visual_style" }],
        visualEvidence: [
          {
            path: "artifacts/sportswellness-desktop.png",
            description: "Sports Wellness rendered screenshot with text-fit checklist, mobile responsive checks, and accessibility notes.",
            source: "rendered_screenshot"
          }
        ],
        codexReport: "Codex says the layout is fixed."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Claim-to-proof: visual claim is fully supported.");
  });

  it("accepts structured data packets when validation, dry-run, and row-count evidence are present", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      structuredPacket({
        task: "Audit whether the admissions data publish claim is proven.",
        targetRepoPath: "/Users/deanguedo/Documents/GitHub/ADMISSION-APP",
        changedFiles: [{ path: "pipeline/build_ualberta_seed_from_coveo.py", changeType: "modified", fileRole: "source" }],
        dataProofArtifacts: [
          {
            description: "validate-canonical passed after dry-run review and row-count diff.",
            source: "dry_run",
            rowCountBefore: 100,
            rowCountAfter: 100,
            duplicateCount: 0,
            unknownFieldCount: 0,
            dryRunPassed: true,
            validationPassed: true,
            configKind: "live"
          }
        ],
        codexReport: "Codex says the data is ready."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Claim-to-proof: data claim is fully supported.");
  });

  it("rejects structured deploy claims missing rollback proof", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      structuredPacket({
        task: "Audit whether publish readiness is proven.",
        targetRepoPath: "/Users/deanguedo/Documents/GitHub/ADMISSION-APP",
        changedFiles: [{ path: "tools/validate-sync-surface.ps1", changeType: "modified", fileRole: "script" }],
        commandEvidence: [
          {
            command: "npm run build:pages",
            cwd: "/Users/deanguedo/Documents/GitHub/ADMISSION-APP",
            repo: "/Users/deanguedo/Documents/GitHub/ADMISSION-APP",
            branch: "main",
            commitSha: "2222222",
            exitCode: 0,
            stdout: "passed",
            stderr: "",
            source: "local_stax_command_output"
          }
        ],
        codexReport: "Codex says the publish flow is ready for Google Sheets target sheet production sync."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Claim-to-proof: release_deploy claim is unsupported");
  });

  it("accepts structured release claims with build, target, rollback, staging, and signing proof", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      structuredPacket({
        task: "Audit whether deployment readiness is proven.",
        targetRepoPath: "/Users/deanguedo/Documents/GitHub/STAX",
        changedFiles: [{ path: "scripts/release-smoke.ts", changeType: "modified", fileRole: "script" }],
        commandEvidence: [
          {
            command: "npm run release:dry-run",
            cwd: "/Users/deanguedo/Documents/GitHub/STAX",
            repo: "/Users/deanguedo/Documents/GitHub/STAX",
            branch: "main",
            commitSha: "3333333",
            exitCode: 0,
            stdout: "release dry run ok",
            stderr: "",
            source: "local_stax_command_output"
          }
        ],
        releaseProofArtifacts: [
          {
            description: "Release build passed, production target validated, rollback tested, staging validated, signing ready.",
            source: "build_log",
            buildPassed: true,
            targetEnvironment: "production",
            targetValidated: true,
            rollbackPlan: "Revert the release bundle and restore the prior artifact.",
            rollbackValidated: true,
            stagingValidated: true,
            authSigningReady: true
          }
        ],
        codexReport: "Codex says the deployment flow is ready for production release with rollback."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Claim-to-proof: release_deploy claim is fully supported.");
  });

  it("rejects structured memory promotion claims missing approval", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      structuredPacket({
        task: "Audit whether this memory promotion is safe.",
        targetRepoPath: "/Users/deanguedo/Documents/GitHub/STAX",
        codexReport: "Codex says it saved this as approved memory because it looked useful."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Claim-to-proof: memory_promotion claim is unsupported because human_approval, source_run_reference");
  });

  it("surfaces PR artifact CI and diff risks inside project-control audits", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      structuredPacket({
        task: "Audit whether this implementation PR is proven.",
        targetRepoPath: "/Users/deanguedo/Documents/GitHub/STAX",
        branch: "main",
        headSha: "new1234",
        codexReport: "Codex says the implementation is complete.",
        pullRequestArtifact: {
          prNumber: 88,
          title: "Document implementation completion",
          body: "Docs refresh only.",
          repo: "/Users/deanguedo/Documents/GitHub/STAX",
          branch: "main",
          commitSha: "new1234",
          changedFiles: ["docs/STAX_9_5_PROMOTION_REPORT.md"],
          unifiedDiff: [
            "diff --git a/docs/STAX_9_5_PROMOTION_REPORT.md b/docs/STAX_9_5_PROMOTION_REPORT.md",
            "--- a/docs/STAX_9_5_PROMOTION_REPORT.md",
            "+++ b/docs/STAX_9_5_PROMOTION_REPORT.md",
            "@@ -1 +1 @@",
            "-old",
            "+new"
          ].join("\n"),
          ciStatuses: [
            {
              workflow: "test",
              status: "success",
              branch: "main",
              commitSha: "old1234",
              summary: "workflow completed successfully",
              failedJobCount: 0,
              cancelledJobCount: 0,
              skippedJobCount: 0
            }
          ],
          reviewComments: [],
          issueLinks: [],
          labels: []
        }
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("PR artifact audit: PR #88 artifact packet supplied.");
    expect(output.output).toContain("PR artifact audit: PR CI test: stale_proof.");
    expect(output.output).toContain("PR artifact audit: PR diff audit rejects the implementation claim");
  });

  it("surfaces partial CI matrix risk inside project-control PR audits", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      structuredPacket({
        task: "Audit whether this implementation PR is proven.",
        targetRepoPath: "/Users/deanguedo/Documents/GitHub/STAX",
        branch: "main",
        headSha: "new1234",
        codexReport: "Codex says the implementation is complete.",
        pullRequestArtifact: {
          prNumber: 89,
          title: "Tighten implementation behavior",
          body: "Includes tests.",
          repo: "/Users/deanguedo/Documents/GitHub/STAX",
          branch: "main",
          commitSha: "new1234",
          changedFiles: ["src/agents/AnalystAgent.ts", "tests/projectControlMode.test.ts"],
          ciStatuses: [
            {
              workflow: "test",
              status: "success",
              branch: "main",
              commitSha: "new1234",
              summary: "workflow completed successfully",
              expectedJobCount: 4,
              completedJobCount: 3,
              failedJobCount: 1,
              cancelledJobCount: 0,
              skippedJobCount: 0
            }
          ],
          reviewComments: [],
          issueLinks: [],
          labels: []
        }
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("PR artifact audit: PR CI test: partial_local_proof.");
    expect(output.output).toContain("PR artifact audit: PR CI risk: matrix or job set is only partially complete.");
  });

  it("downgrades snapshot-only test diffs inside structured project-control packets", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      structuredPacket({
        task: "Audit whether this behavior fix is proven.",
        targetRepoPath: "/Users/deanguedo/Documents/GitHub/STAX",
        changedFiles: [
          {
            path: "src/agents/AnalystAgent.ts",
            changeType: "modified",
            fileRole: "source"
          },
          {
            path: "tests/projectControlMode.test.ts",
            changeType: "modified",
            fileRole: "test",
            patch: [
              "@@",
              "+it('matches snapshot', () => {",
              "+  const tree = render(<Card />);",
              "+  expect(tree).toMatchSnapshot();",
              "+});"
            ].join("\n")
          }
        ],
        commandEvidence: [
          {
            command: "npm test",
            cwd: "/Users/deanguedo/Documents/GitHub/STAX",
            repo: "/Users/deanguedo/Documents/GitHub/STAX",
            branch: "main",
            exitCode: 0,
            stdout: "Tests passed",
            stderr: "",
            source: "local_stax_command_output"
          }
        ],
        codexReport: "Codex says the behavior is verified."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Claim-to-proof: behavior claim is unsupported because");
    expect(output.output).toContain("behavior_test");
  });

  it("downgrades stale structured visual proof inside project-control packets", async () => {
    const runtime = await createDefaultRuntime();
    const output = await runtime.run(
      structuredPacket({
        task: "Audit whether the visual layout fix is proven.",
        targetRepoPath: "/Users/deanguedo/Documents/GitHub/canvas-helper",
        changedFiles: [
          {
            path: "projects/sportswellness/workspace/styles.css",
            changeType: "modified",
            fileRole: "visual_style"
          }
        ],
        visualEvidence: [
          {
            source: "rendered_screenshot",
            description: "Sports Wellness screenshot after fix with mobile responsive and accessibility notes.",
            capturedAt: "2026-05-02T10:00:00.000Z"
          }
        ],
        codexReport: "Codex says the layout is fixed."
      }),
      [],
      { mode: "project_control" }
    );

    expect(output.validation.valid).toBe(true);
    expect(output.output).toContain("Claim-to-proof: visual claim is fully supported.");
  });
});
