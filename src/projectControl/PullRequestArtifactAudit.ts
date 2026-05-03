import { auditDiffEvidence } from "../diffAudit/DiffAudit.js";
import { parseUnifiedDiff } from "../diffAudit/UnifiedDiffParser.js";
import { classifyCiLogEvidence } from "../evidence/CiLogIntelligence.js";
import type { PullRequestArtifactPacket } from "./PullRequestArtifactPacket.js";

export type PullRequestArtifactAuditResult = {
  verdict: "accept" | "provisional" | "reject" | "human_review";
  verified: string[];
  weak: string[];
  unverified: string[];
  risk: string[];
};

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

export function auditPullRequestArtifact(args: {
  packet: PullRequestArtifactPacket;
  task: string;
  expectedBranch?: string;
  expectedCommitSha?: string;
}): PullRequestArtifactAuditResult {
  const { packet } = args;
  const verified: string[] = [];
  const weak: string[] = [];
  const unverified: string[] = [];
  const risk: string[] = [];
  const lowerTask = `${args.task}\n${packet.title}\n${packet.body}`.toLowerCase();

  verified.push(`PR #${packet.prNumber} artifact packet supplied.`);
  if (packet.branch) verified.push(`PR branch is ${packet.branch}.`);
  if (packet.commitSha) verified.push(`PR commit is ${packet.commitSha}.`);
  if (packet.changedFiles.length > 0) verified.push(`PR lists ${packet.changedFiles.length} changed files.`);

  const parsedDiff = packet.unifiedDiff ? parseUnifiedDiff(packet.unifiedDiff) : [];
  if (parsedDiff.length > 0) {
    const diffAudit = auditDiffEvidence({
      repo: packet.repo ?? "unknown",
      branch: packet.branch ?? "unknown",
      baseSha: packet.baseBranch ?? "unknown-base",
      headSha: packet.commitSha ?? "unknown-head",
      objective: args.task,
      changedFiles: parsedDiff.map((file) => ({
        path: file.path,
        changeType: file.changeType,
        fileRole: file.fileRole,
        reason: "Parsed from PR unified diff."
      })),
      claims: [
        {
          claimType: /\bvisual|layout|ui\b/i.test(lowerTask)
            ? "visual"
            : /\bimplement|fix|complete\b/i.test(lowerTask)
              ? "implementation"
              : "behavior",
          text: packet.title,
          hardClaim: true
        }
      ],
      evidence: {
        behaviorTestEvidence: packet.changedFiles.some((file) => file.startsWith("tests/")),
        commandEvidenceAfterDiff: packet.ciStatuses.some((status) => status.status === "success"),
        visualProofProvided: /\b(screenshot|visual checklist|rendered preview|playwright)\b/i.test(packet.body),
        humanApprovalForForbidden: false,
        taskScopePaths: packet.changedFiles,
        forbiddenPaths: []
      }
    });

    if (diffAudit.verdict === "accept") {
      verified.push(`PR diff audit accepts the changed-file evidence (${diffAudit.findings.map((f) => f.id).join(", ") || "clean"}).`);
    } else if (diffAudit.verdict === "provisional") {
      weak.push(`PR diff audit is provisional due to ${diffAudit.findings.map((f) => f.id).join(", ") || "partial proof"}.`);
    } else {
      unverified.push(`PR diff audit rejects the implementation claim due to ${diffAudit.findings.map((f) => f.id).join(", ") || "unsupported diff evidence"}.`);
      risk.push(...diffAudit.findings.slice(0, 2).map((finding) => `PR diff risk: ${finding.message}`));
    }
  }

  for (const status of packet.ciStatuses) {
    const insight = classifyCiLogEvidence({
      workflow: status.workflow,
      jobName: status.jobName,
      branch: status.branch ?? packet.branch,
      commitSha: status.commitSha ?? packet.commitSha,
      conclusion: status.status,
      summary: status.summary ?? status.status,
      log: status.log ?? "",
      startedAt: status.startedAt,
      finishedAt: status.finishedAt,
      expectedBranch: args.expectedBranch ?? packet.branch,
      expectedCommitSha: args.expectedCommitSha ?? packet.commitSha,
      claimType: /\brelease|deploy|publish\b/i.test(lowerTask) ? "release_ready" : "behavior",
      expectedJobCount: status.expectedJobCount,
      completedJobCount: status.completedJobCount,
      failedJobCount: status.failedJobCount,
      cancelledJobCount: status.cancelledJobCount,
      skippedJobCount: status.skippedJobCount
    });
    const label = `PR CI ${status.workflow}: ${insight.proofStrength}.`;
    if (insight.proofStrength === "ci_proof") weak.push(label);
    else if (insight.proofStrength === "not_relevant_to_claim") weak.push(label);
    else unverified.push(label);
    risk.push(...insight.limitations.slice(0, 2).map((item) => `PR CI risk: ${item}.`));
    if (insight.matrixState === "partial") {
      risk.push("PR CI risk: matrix or job set is only partially complete.");
    }
  }

  if (packet.reviewComments.length > 0) {
    verified.push(`PR includes ${packet.reviewComments.length} review comment artifact(s).`);
    if (packet.reviewComments.some((comment) => comment.state !== "resolved")) {
      weak.push("At least one PR review comment remains open or unresolved.");
    }
  }

  if (packet.issueLinks.length > 0) {
    verified.push(`PR links ${packet.issueLinks.length} issue artifact(s).`);
  }

  if (/\bvisual|layout|ui\b/i.test(lowerTask) && !/\b(screenshot|visual checklist|rendered preview|playwright)\b/i.test(packet.body)) {
    unverified.push("PR visual claim remains unverified because no visual artifact is attached.");
    risk.push("PR visual risk: changed CSS or UI files do not prove rendered behavior.");
  }

  if (/\brelease|deploy|publish|sync\b/i.test(lowerTask) && !/\brollback|revert\b/i.test(packet.body)) {
    unverified.push("PR release/deploy claim remains unverified because rollback or revert proof is absent.");
    risk.push("PR release risk: readiness claim lacks rollback language or evidence.");
  }

  const hasReject = unverified.length > 0 && risk.length > 0;
  const hasReview = packet.reviewComments.some((comment) => comment.state !== "resolved");
  const verdict: PullRequestArtifactAuditResult["verdict"] =
    hasReject ? "reject" : hasReview ? "human_review" : weak.length > 0 ? "provisional" : "accept";

  return {
    verdict,
    verified: dedupe(verified),
    weak: dedupe(weak),
    unverified: dedupe(unverified),
    risk: dedupe(risk)
  };
}
