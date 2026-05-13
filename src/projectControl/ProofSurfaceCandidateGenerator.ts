import { nowIso } from "../sidecar/SidecarRepo.js";
import type { CommandSurface } from "./CommandSurfaceDetector.js";
import type { ProofSurfacePack, ProofSurfaceRule } from "./ProofSurfacePackSchemas.js";
import type { RepoDiscoveryResult } from "./RepoDiscoverySchemas.js";
import type { RiskSurface } from "./RiskSurfaceDetector.js";
import { aggregateProofSurfaceConfidence } from "./ProofSurfaceConfidence.js";

export function generateProofSurfaceCandidate(input: {
  discovery: RepoDiscoveryResult;
  detectedStack: string[];
  commandSurfaces: CommandSurface[];
  riskSurfaces: RiskSurface[];
}): ProofSurfacePack {
  const rules: ProofSurfaceRule[] = [];
  const warnings: string[] = [];
  const commandsByKind = (kind: CommandSurface["kind"]) => input.commandSurfaces.filter((surface) => surface.kind === kind).map((surface) => surface.command);
  const buildCommands = [...commandsByKind("build"), ...commandsByKind("typecheck")];
  const testCommands = [...commandsByKind("test"), ...commandsByKind("e2e"), ...commandsByKind("smoke"), ...commandsByKind("validate")];
  if (buildCommands.length > 0) {
    rules.push({
      claimType: "build_ready",
      requiredEvidence: ["local_command_output", "target_repo_cwd"],
      commands: dedupe(buildCommands),
      blockedEvidence: [],
      confidence: "medium",
      source: "package.json scripts",
      nextAction: `Run ${buildCommands[0]} through stax:collect in the target repo.`
    });
  }
  if (testCommands.length > 0) {
    rules.push({
      claimType: "tests_passed",
      requiredEvidence: ["local_command_output", "target_repo_cwd"],
      commands: dedupe(testCommands),
      blockedEvidence: [],
      confidence: "medium",
      source: "package.json scripts",
      nextAction: `Run ${testCommands[0]} through stax:collect in the target repo.`
    });
  }
  if (input.detectedStack.some((stack) => ["html-css", "vite", "playwright", "cypress", "storybook"].includes(stack))) {
    const visualCommands = dedupe([...commandsByKind("e2e"), ...commandsByKind("smoke")]);
    rules.push({
      claimType: "visual_ready",
      requiredEvidence: ["rendered_screenshot", "visual_checklist"],
      commands: visualCommands,
      blockedEvidence: ["css_diff_only", "source_diff_only"],
      confidence: visualCommands.length > 0 ? "high" : "medium",
      source: "workspace/config/script detection",
      nextAction: visualCommands[0]
        ? `Capture rendered visual proof and run ${visualCommands[0]} through stax:collect.`
        : "Capture a rendered screenshot and visual checklist artifact."
    });
    if (visualCommands.length === 0) warnings.push("No visual automation command confirmed; screenshot may require manual artifact.");
  }
  const preflightCommands = dedupe([...commandsByKind("preflight"), ...commandsByKind("validate")]);
  const liveCommands = dedupe([
    ...commandsByKind("publish"),
    ...commandsByKind("sync"),
    ...commandsByKind("deploy"),
    ...commandsByKind("release")
  ]);
  if (liveCommands.length > 0) {
    rules.push({
      claimType: "publish_sync_deploy_ready",
      requiredEvidence: ["human_approval", "non_mutating_preflight", "target_validation"],
      commands: preflightCommands,
      blockedEvidence: ["docs_updated_only", "script_exists_only"],
      confidence: preflightCommands.length > 0 ? "medium" : "low",
      source: "risky package script detection",
      nextAction: preflightCommands[0]
        ? `Run ${preflightCommands[0]} through stax:collect and record explicit target approval.`
        : "Ask a human for the non-mutating preflight or target validation command before claiming readiness."
    });
    if (preflightCommands.length === 0) warnings.push("No safe publish/sync/deploy preflight command was confirmed.");
  }
  const dataCommands = dedupe([...commandsByKind("data"), ...commandsByKind("validate")]);
  if (dataCommands.length > 0 || input.riskSurfaces.some((risk) => risk.kind === "data_pipeline")) {
    rules.push({
      claimType: "data_pipeline_ready",
      requiredEvidence: ["schema_or_fixture_validation", "quality_command_output"],
      commands: dataCommands,
      blockedEvidence: ["file_exists_only", "docs_updated_only"],
      confidence: dataCommands.length > 0 ? "medium" : "low",
      source: "data script/path detection",
      nextAction: dataCommands[0]
        ? `Run ${dataCommands[0]} through stax:collect and cite the validation output.`
        : "Identify and run the repo's schema, fixture, or quality validation command."
    });
  }
  if (input.riskSurfaces.some((risk) => risk.kind === "gold_fixture_mutation")) {
    rules.push({
      claimType: "gold_fixture_update",
      requiredEvidence: ["source_truth_reference", "separate_human_approval", "validation_command_output"],
      commands: commandsByKind("gold"),
      blockedEvidence: ["seed_gold_only", "fixture_update_only"],
      confidence: "high",
      source: "gold/fixture script or path detection",
      nextAction: "Do not treat gold or fixture updates as repair proof without source-truth validation and explicit approval."
    });
  }
  rules.push({
    claimType: "repo_identity",
    requiredEvidence: ["target_repo_cwd", "matching_repo_path", "matching_worktree_fingerprint"],
    commands: [],
    blockedEvidence: ["wrong_repo_command_output"],
    confidence: "high",
    source: "generic STAX sidecar rule",
    nextAction: "Collect command evidence from the target repo root; wrong-repo output cannot verify this repo."
  });

  return {
    schemaVersion: "stax-proof-surface-pack-v1",
    repoPath: input.discovery.repoPath,
    repoName: input.discovery.repoName,
    status: "candidate",
    generatedAt: nowIso(),
    confidence: aggregateProofSurfaceConfidence(rules, warnings.length),
    detectedStack: input.detectedStack,
    proofSurfaces: rules,
    blockedActions: liveCommands.map((command) => ({
      action: command,
      requires: ["explicit human approval", "non-mutating preflight proof", "target validation"]
    })),
    warnings
  };
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)].sort();
}
