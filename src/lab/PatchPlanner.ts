import fs from "node:fs/promises";
import path from "node:path";
import {
  PatchProposalSchema,
  ensureLabDirs,
  labId,
  relativeLabPath,
  type FailureCluster,
  type PatchProposal
} from "./LearningWorker.js";

export class PatchPlanner {
  constructor(private rootDir = process.cwd()) {}

  async plan(input: { clusters: FailureCluster[] }): Promise<Array<{ path: string; markdownPath: string; proposal: PatchProposal }>> {
    await ensureLabDirs(this.rootDir);
    const proposals: Array<{ path: string; markdownPath: string; proposal: PatchProposal }> = [];
    for (const cluster of input.clusters) {
      const proposal = PatchProposalSchema.parse(this.proposalFor(cluster));
      const jsonFile = path.join(this.rootDir, "learning", "lab", "patches", `${proposal.patchId}.json`);
      const markdownFile = path.join(this.rootDir, "learning", "lab", "patches", `${proposal.patchId}.md`);
      await fs.writeFile(jsonFile, JSON.stringify(proposal, null, 2), "utf8");
      await fs.writeFile(markdownFile, this.markdown(proposal, cluster), "utf8");
      proposals.push({
        path: relativeLabPath(this.rootDir, jsonFile),
        markdownPath: relativeLabPath(this.rootDir, markdownFile),
        proposal
      });
    }
    return proposals;
  }

  private proposalFor(cluster: FailureCluster): PatchProposal {
    const patchId = labId(`patch-${cluster.failureType}`);
    const risk = this.risk(cluster);
    const filesToInspect = this.filesToInspect(cluster);
    const filesToModify = this.filesToModify(cluster);
    const testsToAdd = this.testsToAdd(cluster);
    const commandsToRun = [
      "npm run typecheck",
      "npm test",
      "npm run rax -- eval",
      "npm run rax -- eval --regression"
    ];
    return {
      patchId,
      sourceClusterId: cluster.clusterId,
      title: `Address ${cluster.failureType} in ${cluster.mode}`,
      risk,
      filesToInspect,
      filesToModify,
      testsToAdd,
      commandsToRun,
      acceptanceCriteria: [
        `Failure cluster ${cluster.clusterId} has a before/after proof artifact.`,
        "A regression or lab scenario covers the failure.",
        "No promotion, memory, policy, schema, or mode update is approved automatically.",
        "Validation commands pass before review."
      ],
      rollbackPlan: [
        "Revert the implementation commit or discard the generated patch artifact.",
        "Remove only newly generated candidate artifacts if they are not useful.",
        "Keep source LearningEvents and lab reports for audit."
      ],
      codexPrompt: this.codexPrompt(patchId, cluster, filesToInspect, filesToModify, testsToAdd, commandsToRun),
      approvalRequired: true
    };
  }

  private risk(cluster: FailureCluster): PatchProposal["risk"] {
    if (cluster.severity === "critical") return "high";
    if (cluster.suggestedQueueTypes.includes("policy_patch_candidate") || cluster.domain === "redteam_governance") {
      return "high";
    }
    if (cluster.count > 1 || cluster.failureType === "schema_failure") return "medium";
    return "low";
  }

  private filesToInspect(cluster: FailureCluster): string[] {
    const files = new Set<string>(["src/lab/LabRunner.ts", "src/lab/FailureMiner.ts"]);
    if (cluster.mode === "planning") {
      files.add("modes/planning.mode.md");
      files.add("src/validators/PlanningValidator.ts");
      files.add("tests/planningMode.test.ts");
    }
    if (cluster.mode === "learning_unit") {
      files.add("modes/learning_unit.mode.md");
      files.add("src/validators/LearningUnitValidator.ts");
    }
    if (cluster.mode === "policy_drift") {
      files.add("modes/policy_drift.mode.md");
      files.add("src/validators/PolicyDriftValidator.ts");
    }
    if (cluster.domain === "redteam_governance") {
      files.add("src/lab/RedTeamGenerator.ts");
      files.add("evals/regression");
    }
    return Array.from(files);
  }

  private filesToModify(cluster: FailureCluster): string[] {
    if (cluster.failureType === "missing_section" || cluster.failureType === "expected_property") {
      return ["tests/learningLab.test.ts", "evals/regression/<new-case>.json"];
    }
    if (cluster.failureType === "policy_gap") {
      return ["tests/learningLab.test.ts", "learning/lab/patches/<proposal-only>.md"];
    }
    return ["tests/learningLab.test.ts"];
  }

  private testsToAdd(cluster: FailureCluster): string[] {
    return [
      `Regression test for ${cluster.failureType} in ${cluster.mode}.`,
      "Negative control proving no durable artifact is promoted automatically.",
      "Lab before/after proof using the source scenario IDs."
    ];
  }

  private codexPrompt(
    patchId: string,
    cluster: FailureCluster,
    filesToInspect: string[],
    filesToModify: string[],
    testsToAdd: string[],
    commandsToRun: string[]
  ): string {
    return [
      `# STAX Lab Patch Proposal ${patchId}`,
      "",
      "Goal: fix the failure cluster without weakening governance.",
      "",
      `Cluster: ${cluster.clusterId}`,
      `Failure type: ${cluster.failureType}`,
      `Mode: ${cluster.mode}`,
      `Severity: ${cluster.severity}`,
      "",
      "Files to inspect:",
      ...filesToInspect.map((file) => `- ${file}`),
      "",
      "Files likely to modify:",
      ...filesToModify.map((file) => `- ${file}`),
      "",
      "Tests to add:",
      ...testsToAdd.map((test) => `- ${test}`),
      "",
      "Commands to run:",
      ...commandsToRun.map((command) => `- ${command}`),
      "",
      "Boundaries:",
      "- Do not approve, promote, or merge anything automatically.",
      "- Do not enable shell/fileWrite/web/git push permissions.",
      "- Do not edit policies, schemas, modes, AGENTS.md, or config without human review.",
      "- Keep synthetic lab data quarantined as candidate-only.",
      "",
      "Stop conditions:",
      "- Stop if validation fails.",
      "- Stop if a fix requires weakening a safety gate.",
      "- Stop if source evidence is insufficient."
    ].join("\n");
  }

  private markdown(proposal: PatchProposal, cluster: FailureCluster): string {
    return [
      `# ${proposal.title}`,
      "",
      `Patch ID: ${proposal.patchId}`,
      `Source cluster: ${proposal.sourceClusterId}`,
      `Risk: ${proposal.risk}`,
      `Approval Required: ${proposal.approvalRequired}`,
      "",
      "## Failure Cluster",
      `- Type: ${cluster.failureType}`,
      `- Mode: ${cluster.mode}`,
      `- Domain: ${cluster.domain}`,
      `- Count: ${cluster.count}`,
      `- Severity: ${cluster.severity}`,
      "",
      "## Files To Inspect",
      ...proposal.filesToInspect.map((file) => `- ${file}`),
      "",
      "## Files To Modify",
      ...proposal.filesToModify.map((file) => `- ${file}`),
      "",
      "## Tests To Add",
      ...proposal.testsToAdd.map((test) => `- ${test}`),
      "",
      "## Commands To Run",
      ...proposal.commandsToRun.map((command) => `- ${command}`),
      "",
      "## Acceptance Criteria",
      ...proposal.acceptanceCriteria.map((criterion) => `- ${criterion}`),
      "",
      "## Rollback Plan",
      ...proposal.rollbackPlan.map((step) => `- ${step}`),
      "",
      "## Codex Prompt",
      "```md",
      proposal.codexPrompt,
      "```"
    ].join("\n");
  }
}
