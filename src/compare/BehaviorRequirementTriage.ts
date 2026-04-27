import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { BehaviorRequirement } from "./BehaviorMiner.js";

export const BehaviorTriageDispositionSchema = z.enum([
  "reject_noise",
  "needs_human_review",
  "eval_candidate_seed",
  "proof_receipt_candidate",
  "workspace_audit_candidate",
  "codex_handoff_candidate",
  "safety_redteam_candidate"
]);

export const BehaviorTriageRiskSchema = z.enum(["low", "medium", "high"]);

export const BehaviorTriageRecordSchema = z.object({
  requirementId: z.string().min(1),
  category: z.string().min(1),
  disposition: BehaviorTriageDispositionSchema,
  risk: BehaviorTriageRiskSchema,
  priorityScore: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  failureMode: z.string().min(1),
  testableBehavior: z.boolean(),
  promotionBoundary: z.literal("candidate_only"),
  artifactStatus: z.array(z.object({
    path: z.string().min(1),
    status: z.enum(["exists", "missing_artifact"])
  })),
  reason: z.string().min(1)
});

export const BehaviorNextSliceSchema = z.object({
  sliceId: z.string().min(1),
  title: z.string().min(1),
  reason: z.string().min(1),
  sourceDispositions: z.array(BehaviorTriageDispositionSchema),
  filesToInspect: z.array(z.string()),
  testsToAdd: z.array(z.string()),
  evalsToAdd: z.array(z.string()),
  stopCondition: z.string().min(1),
  doNotBuildYet: z.array(z.string())
});

export const BehaviorTriageReportSchema = z.object({
  createdAt: z.string().min(1),
  sourceRequirementCount: z.number().int().nonnegative(),
  newCandidateCount: z.number().int().nonnegative(),
  groupedCounts: z.record(BehaviorTriageDispositionSchema, z.number().int().nonnegative()),
  records: z.array(BehaviorTriageRecordSchema),
  topRisks: z.array(z.string()),
  nextSlice: BehaviorNextSliceSchema,
  promotionBoundary: z.literal("candidate_only"),
  writtenPath: z.string().optional()
});

export type BehaviorTriageDisposition = z.infer<typeof BehaviorTriageDispositionSchema>;
export type BehaviorTriageRecord = z.infer<typeof BehaviorTriageRecordSchema>;
export type BehaviorTriageReport = z.infer<typeof BehaviorTriageReportSchema>;

export class BehaviorRequirementTriage {
  constructor(private rootDir = process.cwd()) {}

  async triage(requirements: BehaviorRequirement[], options: { write?: boolean } = {}): Promise<BehaviorTriageReport> {
    const newCandidates = requirements.filter((item) => item.status === "new_candidate");
    const records = await Promise.all(newCandidates.map((item) => this.toRecord(item)));
    const groupedCounts = emptyGroupedCounts();
    for (const record of records) {
      groupedCounts[record.disposition] += 1;
    }
    const report: BehaviorTriageReport = BehaviorTriageReportSchema.parse({
      createdAt: new Date().toISOString(),
      sourceRequirementCount: requirements.length,
      newCandidateCount: newCandidates.length,
      groupedCounts,
      records: records.sort((a, b) => b.priorityScore - a.priorityScore || a.requirementId.localeCompare(b.requirementId)),
      topRisks: this.topRisks(records),
      nextSlice: this.nextSlice(records),
      promotionBoundary: "candidate_only"
    });

    if (!options.write) return report;
    const file = path.join(this.rootDir, "learning", "extraction", "triage", "latest.json");
    await fs.mkdir(path.dirname(file), { recursive: true });
    const writtenPath = path.relative(this.rootDir, file);
    const written = BehaviorTriageReportSchema.parse({ ...report, writtenPath });
    await fs.writeFile(file, JSON.stringify(written, null, 2), "utf8");
    return written;
  }

  format(report: BehaviorTriageReport, options: { limit?: number } = {}): string {
    const limit = options.limit ?? 12;
    const visibleRecords = report.records
      .filter((record) => record.disposition !== "reject_noise")
      .slice(0, limit);
    return [
      "## Behavior Requirement Triage",
      `SourceRequirements: ${report.sourceRequirementCount}`,
      `NewCandidates: ${report.newCandidateCount}`,
      `PromotionBoundary: ${report.promotionBoundary}`,
      report.writtenPath ? `Written: ${report.writtenPath}` : "Written: no (dry-run)",
      "",
      "## Grouped Counts",
      ...Object.entries(report.groupedCounts).map(([key, value]) => `- ${key}: ${value}`),
      "",
      "## Top Risks",
      ...report.topRisks.map((risk) => `- ${risk}`),
      "",
      "## Next Slice",
      `Slice: ${report.nextSlice.title}`,
      `Reason: ${report.nextSlice.reason}`,
      `StopCondition: ${report.nextSlice.stopCondition}`,
      "",
      "## Files To Inspect",
      ...report.nextSlice.filesToInspect.map((file) => `- ${file}`),
      "",
      "## Tests / Evals To Add",
      ...report.nextSlice.testsToAdd.map((file) => `- ${file}`),
      ...report.nextSlice.evalsToAdd.map((file) => `- ${file}`),
      "",
      "## Do Not Build Yet",
      ...report.nextSlice.doNotBuildYet.map((item) => `- ${item}`),
      "",
      "## Top Candidate Records",
      ...visibleRecords.map((record) => [
        `- ${record.requirementId} [${record.disposition}/${record.risk}/${record.priorityScore}] ${record.summary}`,
        `  FailureMode: ${record.failureMode}`,
        `  Artifacts: ${record.artifactStatus.map((artifact) => `${artifact.path}:${artifact.status}`).join(", ")}`
      ].join("\n"))
    ].join("\n");
  }

  private async toRecord(requirement: BehaviorRequirement): Promise<BehaviorTriageRecord> {
    const disposition = this.disposition(requirement);
    const artifactStatus = await Promise.all(requirement.suggestedArtifacts.map(async (artifact) => ({
      path: artifact,
      status: await this.artifactExists(artifact) ? "exists" as const : "missing_artifact" as const
    })));
    const testable = this.isTestable(requirement.summary);
    return BehaviorTriageRecordSchema.parse({
      requirementId: requirement.requirementId,
      category: requirement.category,
      disposition,
      risk: this.risk(requirement, disposition),
      priorityScore: this.priorityScore(requirement, disposition, testable, artifactStatus.some((artifact) => artifact.status === "exists")),
      summary: requirement.summary,
      failureMode: this.failureMode(requirement),
      testableBehavior: testable,
      promotionBoundary: "candidate_only",
      artifactStatus,
      reason: this.reason(requirement, disposition, testable)
    });
  }

  private disposition(requirement: BehaviorRequirement): BehaviorTriageDisposition {
    if (this.isNoise(requirement.summary)) return "reject_noise";
    if (requirement.category === "proof") return "proof_receipt_candidate";
    if (requirement.category === "workspace") return "workspace_audit_candidate";
    if (requirement.category === "eval" || requirement.category === "benchmark") return "eval_candidate_seed";
    if (requirement.category === "codex") return "codex_handoff_candidate";
    if (requirement.category === "safety") return "safety_redteam_candidate";
    return "needs_human_review";
  }

  private isNoise(summary: string): boolean {
    return /^ask:\s/i.test(summary)
      || /^proposed subsystem adds\b/i.test(summary)
      || /^defines outcome metric\b/i.test(summary)
      || /^repo has dependencies\b/i.test(summary)
      || /^user asks to build\b/i.test(summary)
      || /^more testing needed$/i.test(summary)
      || /^stax must convert$/i.test(summary);
  }

  private isTestable(summary: string): boolean {
    const text = summary.toLowerCase();
    return /\b(must|should|requires?|identify|detect|label|distinguish|block|reject|route|score|check|prove|avoid|downgrade)\b/.test(text)
      && !/^ask:\s/i.test(summary)
      && summary.split(/\s+/).length >= 7;
  }

  private risk(requirement: BehaviorRequirement, disposition: BehaviorTriageDisposition): "low" | "medium" | "high" {
    const text = requirement.summary.toLowerCase();
    if (/(secret|credential|policy|permission|promotion|training|memory|external repo|shell|file-write|file write|git push|approval)/.test(text)) {
      return "high";
    }
    if (disposition === "reject_noise") return "low";
    if (disposition === "needs_human_review" || disposition === "codex_handoff_candidate" || disposition === "safety_redteam_candidate") {
      return "high";
    }
    return "medium";
  }

  private priorityScore(
    requirement: BehaviorRequirement,
    disposition: BehaviorTriageDisposition,
    testable: boolean,
    hasExistingArtifact: boolean
  ): number {
    if (disposition === "reject_noise") return 5;
    let score = 30;
    if (testable) score += 20;
    if (hasExistingArtifact) score += 10;
    if (disposition === "proof_receipt_candidate") score += 18;
    if (disposition === "workspace_audit_candidate") score += 14;
    if (disposition === "eval_candidate_seed") score += 12;
    if (disposition === "safety_redteam_candidate") score += 10;
    if (/(evidence|verified|proof|pasted|local|trace|eval|command|flaky|stale|conflicting)/i.test(requirement.summary)) {
      score += 10;
    }
    return Math.min(100, score);
  }

  private failureMode(requirement: BehaviorRequirement): string {
    const text = requirement.summary.toLowerCase();
    if (/(evidence|proof|verified|claim)/.test(text)) return "STAX could mark a weak or unsupported claim as verified.";
    if (/(workspace|repo|package|file)/.test(text)) return "STAX could apply a repo-wide conclusion outside the inspected workspace scope.";
    if (/(eval|test|benchmark)/.test(text)) return "STAX could add a shallow eval that checks headings instead of behavior.";
    if (/(codex|handoff|patch)/.test(text)) return "STAX could hand Codex an over-broad task with no proof or stop condition.";
    if (/(secret|permission|policy|safety|block)/.test(text)) return "STAX could weaken a boundary or fail to hard-block a critical request.";
    return "STAX could turn a mined candidate into vague backlog instead of a testable behavior.";
  }

  private reason(requirement: BehaviorRequirement, disposition: BehaviorTriageDisposition, testable: boolean): string {
    if (disposition === "reject_noise") return "Rejected from the implementation queue because it is an example, prompt fragment, or non-testable wording.";
    if (!testable) return "Needs human review before any eval or patch because the behavior is not yet testable.";
    return `Candidate-only triage record for ${requirement.category}; no eval, memory, training data, policy, schema, mode, or source patch was promoted.`;
  }

  private topRisks(records: BehaviorTriageRecord[]): string[] {
    const noise = records.filter((record) => record.disposition === "reject_noise").length;
    const missingArtifacts = records.filter((record) => record.artifactStatus.some((artifact) => artifact.status === "missing_artifact")).length;
    const highRisk = records.filter((record) => record.risk === "high").length;
    return [
      `${noise} mined candidates are noise-like and should not become evals or policy.`,
      `${missingArtifacts} candidates point at missing artifacts and need bounded planning before implementation.`,
      `${highRisk} candidates are high-risk and require human review before promotion or source changes.`
    ];
  }

  private nextSlice(records: BehaviorTriageRecord[]): z.infer<typeof BehaviorNextSliceSchema> {
    const proofCount = records.filter((record) => record.disposition === "proof_receipt_candidate").length;
    const workspaceCount = records.filter((record) => record.disposition === "workspace_audit_candidate").length;
    const evalCount = records.filter((record) => record.disposition === "eval_candidate_seed").length;

    if (proofCount >= workspaceCount && proofCount >= evalCount) {
      return {
        sliceId: "evidence_decision_gate",
        title: "Evidence-to-Decision Gate",
        reason: "Proof/evidence candidates are the largest high-value cluster, so the next implementation should prevent weak, pasted, stale, or missing evidence from becoming verified claims.",
        sourceDispositions: ["proof_receipt_candidate", "eval_candidate_seed"],
        filesToInspect: [
          "src/audit/VerifiedAuditContract.ts",
          "src/audit/EvidenceSufficiencyScorer.ts",
          "src/validators/CodexAuditValidator.ts",
          "src/validators/ModelComparisonValidator.ts",
          "src/evaluators/PropertyEvaluator.ts"
        ],
        testsToAdd: ["tests/evidenceDecisionGate.test.ts"],
        evalsToAdd: [
          "evals/regression/evidence_decision_no_local_proof.json",
          "evals/regression/evidence_decision_pasted_test_claim.json",
          "evals/regression/evidence_decision_local_trace_eval.json"
        ],
        stopCondition: "Pasted or missing evidence cannot produce a verified decision, while local trace/eval/command evidence can only verify within its stated scope.",
        doNotBuildYet: ["web UI", "autonomous agents", "auto-promotion", "training export", "broad proof subsystem rewrite"]
      };
    }

    return {
      sliceId: "workspace_scope_gate",
      title: "Workspace Scope Gate",
      reason: "Workspace candidates dominate the remaining mined behavior, so the next implementation should prevent repo-wide claims from weak or ambiguous workspace evidence.",
      sourceDispositions: ["workspace_audit_candidate", "eval_candidate_seed"],
      filesToInspect: ["src/workspace/RepoEvidencePack.ts", "src/workspace/WorkspaceContext.ts", "src/validators/CodexAuditValidator.ts"],
      testsToAdd: ["tests/workspaceScopeGate.test.ts"],
      evalsToAdd: ["evals/regression/workspace_scope_no_repo_wide_claim.json"],
      stopCondition: "STAX refuses repo-wide conclusions when the inspected package/workspace boundary is ambiguous or incomplete.",
      doNotBuildYet: ["linked repo writes", "global workspace mutation", "auto-running external repo commands"]
    };
  }

  private async artifactExists(artifact: string): Promise<boolean> {
    try {
      await fs.stat(path.join(this.rootDir, artifact));
      return true;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }
}

function emptyGroupedCounts(): Record<BehaviorTriageDisposition, number> {
  return {
    reject_noise: 0,
    needs_human_review: 0,
    eval_candidate_seed: 0,
    proof_receipt_candidate: 0,
    workspace_audit_candidate: 0,
    codex_handoff_candidate: 0,
    safety_redteam_candidate: 0
  };
}
