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
            description: "rendered screenshot with text-fit checklist",
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
});
