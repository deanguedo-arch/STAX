import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EvidenceGroundingGate } from "../src/evidence/EvidenceGroundingGate.js";
import type { CommandEvidence } from "../src/evidence/CommandEvidenceStore.js";
import { ProofStrengthGate, summarizeProofStrength } from "../src/evidence/ProofStrengthGate.js";
import type { ProofStrengthClaimType, ProofStrengthResult } from "../src/evidence/ProofStrengthSchemas.js";
import { RunLogger, type RunLoggerPayload } from "../src/core/RunLogger.js";
import type { RepoEvidencePack } from "../src/workspace/RepoEvidenceSchemas.js";
import type { RaxConfig } from "../src/schemas/Config.js";
import { RunTraceSchema } from "../src/schemas/zodSchemas.js";

describe("ProofStrengthGate", () => {
  it("treats local command evidence with exitCode 0 as strong tests_passed proof", () => {
    const repo = repoEvidence();
    const command = commandEvidence({ source: "local_stax_command_output" });
    const result = evaluate({
      claimType: "tests_passed",
      claimText: "npm test passed for src/index.ts.",
      repoEvidence: repo,
      commandEvidence: [command]
    });

    expect(result.label).toBe("Strong");
    expect(result.rejectReasons).toEqual([]);
    expect(result.capApplied).toEqual([]);
    expect(result.strongProof.join("\n")).toContain("Local STAX command evidence passed: npm test exited 0.");
  });

  it("caps Codex-reported command output at Provisional", () => {
    const result = evaluate({
      claimType: "tests_passed",
      claimText: "Codex reported npm test passed; treat this as provisional until local STAX command evidence exists.",
      commandEvidence: [commandEvidence({ source: "codex_reported_command_output" })]
    });

    expect(result.capApplied.map((cap) => cap.id)).toContain("codex_reported_command_only");
    expect(result.label).toBe("Provisional");
  });

  it("rejects failed command evidence", () => {
    const result = evaluate({
      claimType: "tests_passed",
      claimText: "npm test passed.",
      commandEvidence: [commandEvidence({ exitCode: 1, success: false, status: "failed" })]
    });

    expect(result.label).toBe("Reject");
    expect(result.rejectReasons.join("\n")).toContain("Failed command evidence");
    expect(result.oneNextAction).toContain("Fix the failing command");
  });

  it("caps implementation_complete at Provisional when command evidence is missing", () => {
    const result = evaluate({
      claimType: "implementation_complete",
      claimText: "Implementation is complete in src/index.ts."
    });

    expect(result.capApplied.map((cap) => cap.id)).toContain("missing_command_evidence");
    expect(scoreRank(result.label)).toBeLessThanOrEqual(scoreRank("Provisional"));
  });

  it("rejects docs-only implementation proof", () => {
    const repo = repoEvidence({
      sourceFiles: [],
      testFiles: [],
      docsFiles: ["docs/guide.md"],
      importantFiles: ["docs/guide.md"]
    });
    const result = evaluate({
      claimType: "implementation_complete",
      claimText: "Implementation is complete in docs/guide.md.",
      repoEvidence: repo,
      commandEvidence: [commandEvidence({ source: "local_stax_command_output" })]
    });

    expect(result.label).toBe("Reject");
    expect(result.rejectReasons.join("\n")).toContain("Docs-only evidence");
  });

  it("caps visual behavior claims without visual proof at Provisional", () => {
    const result = evaluate({
      claimType: "visual_behavior_verified",
      claimText: "The resize behavior was visually verified in src/index.ts.",
      commandEvidence: [commandEvidence({ source: "local_stax_command_output" })]
    });

    expect(result.capApplied.map((cap) => cap.id)).toContain("visual_claim_without_visual_proof");
    expect(scoreRank(result.label)).toBeLessThanOrEqual(scoreRank("Provisional"));
    expect(result.oneNextAction).toContain("Capture rendered visual proof");
  });

  it("caps release_ready without preflight or release evidence at Provisional", () => {
    const result = evaluate({
      claimType: "release_ready",
      claimText: "The app is release ready.",
      commandEvidence: [commandEvidence({ source: "local_stax_command_output" })]
    });

    expect(result.capApplied.map((cap) => cap.id)).toContain("release_ready_without_release_proof");
    expect(scoreRank(result.label)).toBeLessThanOrEqual(scoreRank("Provisional"));
  });

  it("caps security_fixed without security-specific proof at Provisional", () => {
    const result = evaluate({
      claimType: "security_fixed",
      claimText: "The injection bug is security fixed.",
      commandEvidence: [commandEvidence({ source: "local_stax_command_output" })]
    });

    expect(result.capApplied.map((cap) => cap.id)).toContain("security_fixed_without_security_proof");
    expect(scoreRank(result.label)).toBeLessThanOrEqual(scoreRank("Provisional"));
  });

  it("rejects wrong repo/workspace command evidence when context is supplied", () => {
    const result = evaluate({
      claimType: "tests_passed",
      claimText: "npm test passed.",
      repoEvidence: repoEvidence({ repoPath: "/repos/right", workspace: "right-workspace" }),
      commandEvidence: [commandEvidence({ cwd: "/repos/wrong", workspace: "wrong-workspace" })]
    });

    expect(result.label).toBe("Reject");
    expect(result.rejectReasons.join("\n")).toContain("Wrong repo/cwd command evidence");
    expect(result.rejectReasons.join("\n")).toContain("Wrong workspace command evidence");
  });

  it("writes proof_strength.json and trace summary through RunLogger", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "proof-strength-run-"));
    const proofStrength = evaluate({
      claimType: "tests_passed",
      claimText: "npm test passed.",
      commandEvidence: [commandEvidence({ source: "local_stax_command_output" })]
    });
    const createdAt = "2026-05-11T00:00:00.000Z";
    const payload = runLoggerPayload(rootDir, proofStrength, createdAt);

    const runDir = await new RunLogger(rootDir).log(payload);
    const artifact = JSON.parse(await fs.readFile(path.join(runDir, "proof_strength.json"), "utf8")) as ProofStrengthResult;
    const trace = JSON.parse(await fs.readFile(path.join(runDir, "trace.json"), "utf8")) as { proofStrength?: { label: string; capApplied: string[] } };

    expect(artifact.schemaVersion).toBe("proof-strength-v1");
    expect(artifact.label).toBe("Strong");
    expect(trace.proofStrength?.label).toBe("Strong");
    expect(trace.proofStrength?.capApplied).toEqual([]);
    expect(() => RunTraceSchema.parse(trace)).not.toThrow();
  });
});

function evaluate(input: {
  claimType: ProofStrengthClaimType;
  claimText: string;
  repoEvidence?: RepoEvidencePack;
  commandEvidence?: CommandEvidence[];
  evidenceFlags?: { visualProof?: boolean; releasePreflight?: boolean; releaseGate?: boolean; rollbackPlan?: boolean; securityProof?: boolean };
}): ProofStrengthResult {
  const groundingResult = new EvidenceGroundingGate().evaluate({
    output: input.claimText,
    repoEvidence: input.repoEvidence ?? repoEvidence(),
    commandEvidence: input.commandEvidence ?? []
  });
  return new ProofStrengthGate().evaluate({
    claimType: input.claimType,
    claimText: input.claimText,
    groundingResult,
    commandEvidence: input.commandEvidence ?? [],
    repoEvidence: input.repoEvidence ?? repoEvidence(),
    evidenceFlags: input.evidenceFlags ?? {}
  });
}

function commandEvidence(patch: Partial<CommandEvidence> = {}): CommandEvidence {
  const exitCode = patch.exitCode ?? 0;
  return {
    commandEvidenceId: patch.commandEvidenceId ?? `cmd-${patch.source ?? "local"}`,
    command: patch.command ?? "npm test",
    args: patch.args ?? ["test"],
    exitCode,
    success: patch.success ?? exitCode === 0,
    source: patch.source ?? "local_stax_command_output",
    status: patch.status ?? (exitCode === 0 ? "passed" : "failed"),
    commandFamily: patch.commandFamily ?? "test",
    stdoutPath: patch.stdoutPath ?? "stdout.txt",
    stderrPath: patch.stderrPath ?? "stderr.txt",
    stdoutTruncated: patch.stdoutTruncated ?? false,
    stderrTruncated: patch.stderrTruncated ?? false,
    redactionCount: patch.redactionCount ?? 0,
    summary: patch.summary ?? "npm test passed",
    createdAt: patch.createdAt ?? "2026-05-11T00:00:00.000Z",
    hash: patch.hash ?? "hash",
    cwd: patch.cwd,
    workspace: patch.workspace,
    linkedRepoPath: patch.linkedRepoPath
  };
}

function repoEvidence(patch: Partial<RepoEvidencePack> = {}): RepoEvidencePack {
  return {
    repoPath: patch.repoPath ?? "/repos/demo",
    workspace: patch.workspace ?? "demo",
    workspaceResolution: patch.workspaceResolution ?? "current_repo",
    createdAt: patch.createdAt ?? "2026-05-11T00:00:00.000Z",
    gitStatus: patch.gitStatus ?? "## main",
    inspectedFiles: patch.inspectedFiles ?? ["package.json"],
    importantFiles: patch.importantFiles ?? ["package.json", "src/index.ts", "tests/index.test.ts"],
    configFiles: patch.configFiles ?? ["package.json"],
    sourceFiles: patch.sourceFiles ?? ["src/index.ts"],
    testFiles: patch.testFiles ?? ["tests/index.test.ts"],
    docsFiles: patch.docsFiles ?? [],
    operationalFiles: patch.operationalFiles ?? [],
    scripts: patch.scripts ?? [{ name: "test", command: "vitest" }],
    missingExpectedFiles: patch.missingExpectedFiles ?? [],
    riskFlags: patch.riskFlags ?? [],
    skippedPaths: patch.skippedPaths ?? [],
    redactions: patch.redactions ?? [],
    snippets: patch.snippets ?? [],
    markdown: patch.markdown ?? "## Repo Evidence Pack"
  };
}

function scoreRank(label: string): number {
  return ["Missing", "Weak", "Provisional", "Strong", "Audit-grade"].indexOf(label);
}

function runLoggerPayload(rootDir: string, proofStrength: ProofStrengthResult, createdAt: string): RunLoggerPayload {
  const trace = {
    runId: "run-proof-strength",
    createdAt,
    runtimeVersion: "1.0.0",
    provider: "mock",
    model: "mock-model",
    providerRoles: { generator: "mock", critic: "mock", evaluator: "mock", classifier: "rules" },
    criticModel: "mock-critic",
    evaluatorModel: "mock-evaluator",
    classifierModel: "rules",
    temperature: 0,
    criticTemperature: 0,
    evalTemperature: 0,
    topP: 1,
    seed: 42,
    mode: "project_control" as const,
    modeConfidence: 1,
    boundaryMode: "allow" as const,
    selectedAgent: "analyst",
    policiesApplied: [],
    criticPasses: 1,
    repairPasses: 0,
    formatterPasses: 1,
    schemaRetries: 0,
    latencyMs: 1,
    toolCalls: [],
    errors: [],
    route: {},
    replayable: true,
    modelCalls: [],
    validation: {},
    proofStrength: summarizeProofStrength(proofStrength)
  };
  return {
    runId: "run-proof-strength",
    input: "Audit this proof.",
    config: { runtime: { version: "1.0.0" } } as RaxConfig,
    stack: [],
    risk: {
      intent: 0,
      harm: 0,
      actionability: 0,
      privacy: 0,
      exploitation: 0,
      regulatedAdvice: 0,
      systemIntegrity: 0,
      total: 0,
      labels: []
    },
    boundary: { mode: "allow", reason: "test", allowedDetailLevel: "standard" },
    final: "done",
    trace,
    proofStrength,
    createdAt
  };
}
