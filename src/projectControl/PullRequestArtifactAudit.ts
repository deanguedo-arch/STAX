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

export function suggestPullRequestComment(args: {
  packet: PullRequestArtifactPacket;
  audit: PullRequestArtifactAuditResult;
}): string {
  const firstUnverified = args.audit.unverified[0] ?? "proof remains incomplete";
  const firstRisk = args.audit.risk[0] ?? "the proof boundary is still weak";
  const packet = args.packet;
  const expectedSha = packet.commitSha ?? "the current PR head SHA";
  const openReview = packet.reviewComments.some((comment) => comment.state !== "resolved");
  const ciSummary = packet.ciStatuses[0];
  const firstWorkflow = ciSummary?.workflow ?? "the relevant workflow";
  const lowerUnverified = args.audit.unverified.join("\n").toLowerCase();
  const lowerWeak = args.audit.weak.join("\n").toLowerCase();
  const lowerRisk = args.audit.risk.join("\n").toLowerCase();

  if (args.audit.verdict === "accept") {
    return `This public PR artifact looks bounded and internally consistent, but it still needs human approval and repo-local proof before any merge or release claim. Please keep this artifact packet attached for the final human decision.`;
  }
  if (args.audit.verdict === "human_review") {
    if (openReview) {
      return `This needs human review before approval because at least one review thread is still open. Please resolve the open thread(s), keep the artifact packet aligned to ${expectedSha}, and return with the updated review state.`;
    }
    return `This needs human review before approval because ${stripPrefix(firstRisk).toLowerCase()}. Please return with the smallest updated artifact packet after the review concern is resolved.`;
  }
  if (args.audit.verdict === "reject") {
    if (/wrong_commit|stale_proof|wrong_branch/.test(lowerUnverified)) {
      return `This is not ready to accept because the CI proof is not aligned to ${expectedSha}. Please rerun ${firstWorkflow} on ${expectedSha} and return the job output plus branch, commit, and completion state.`;
    }
    if (/docs_only_implementation_claim/.test(lowerUnverified)) {
      return `This is not ready to accept because the diff is docs-only and does not prove the implementation claim. Please return with the source diff and the smallest test or command proof packet for the claimed behavior.`;
    }
    if (/visual claim remains unverified/.test(lowerUnverified)) {
      return `This is not ready to accept because the visual claim has no rendered proof. Please attach the relevant screenshot or visual checklist for the changed state and return with the bounded artifact packet.`;
    }
    if (/release\/deploy claim remains unverified/.test(lowerUnverified) || /rollback/.test(lowerRisk)) {
      return `This is not ready to accept because the release proof is incomplete. Please return with the build result, target environment proof, and rollback or revert evidence for this PR state.`;
    }
    if (/fixture|golden/.test(lowerRisk)) {
      return `This is not ready to accept because fixture or golden-file changes can hide behavior drift. Please return with the smallest behavior test proof and explain what changed in the fixture artifact.`;
    }
    return `This is not ready to accept because ${stripPrefix(firstUnverified)}. Please return with the smallest missing proof packet instead of a completion claim.`;
  }
  if (/ci_proof|not_relevant_to_claim/.test(lowerUnverified) || /ci_proof|not_relevant_to_claim/.test(lowerWeak) || /ci_proof/.test(lowerRisk)) {
    return `This should stay provisional because the available CI proof is not yet strong enough for the claim. Please add the smallest local or claim-relevant proof artifact before asking for approval.`;
  }
  return `This should stay provisional because ${stripPrefix(firstUnverified)}. Please add the smallest missing proof artifact before asking for approval.`;
}

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
  const claimsImplementation = /\bimplement|implementation|fix|behavior|build\b/i.test(lowerTask);
  const claimsRelease = /\brelease|deploy|publish|sync\b/i.test(lowerTask);
  const claimsVisual = /\bvisual|layout|ui\b/i.test(lowerTask);

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
        oldPath: file.oldPath,
        newPath: file.newPath,
        patch: file.patch,
        addedLines: file.addedLines,
        deletedLines: file.deletedLines,
        reason: "Parsed from PR unified diff."
      })),
      claims: [
        {
          claimType: claimsVisual
            ? "visual"
            : /\bimplement|fix|complete|build\b/i.test(lowerTask)
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
        dependencyProofProvided: packet.ciStatuses.some((status) => status.status === "success") && parsedDiff.some((file) => /(^|\/)(package\.json|requirements(\.txt)?|pyproject\.toml|cargo\.toml|go\.mod|composer\.json|gemfile)$/i.test(file.path)),
        rollbackProofProvided: /\brollback|revert|downgrade\b/i.test(packet.body),
        securityProofProvided: /\bsecurity test|secret scan|vulnerability|prompt injection\b/i.test(packet.body),
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

  if (claimsImplementation && parsedDiff.length === 0) {
    unverified.push("PR artifact lacks unified diff evidence for the claimed implementation or behavior change.");
    risk.push("PR diff risk: changed-file names alone do not prove the claimed implementation path.");
  }

  if ((claimsImplementation || claimsRelease) && packet.ciStatuses.length === 0) {
    weak.push("PR artifact has no CI or command proof for the claimed implementation, behavior, build, or release change.");
    weak.push("PR CI unavailable: partial_local_proof.");
    risk.push("PR CI risk: no workflow or command-status artifact was supplied.");
  }

  for (const status of packet.ciStatuses) {
    const insight = classifyCiLogEvidence({
      workflow: status.workflow,
      jobName: status.jobName,
      provider: status.provider,
      branch: status.branch ?? packet.branch,
      commitSha: status.commitSha ?? packet.commitSha,
      conclusion: status.status,
      summary: status.summary ?? status.status,
      log: status.log ?? "",
      startedAt: status.startedAt,
      finishedAt: status.finishedAt,
      runId: status.runId,
      runUrl: status.runUrl,
      attempt: status.attempt,
      eventName: status.eventName,
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

  if (claimsVisual && !/\b(screenshot|visual checklist|rendered preview|playwright)\b/i.test(packet.body)) {
    unverified.push("PR visual claim remains unverified because no visual artifact is attached.");
    risk.push("PR visual risk: changed CSS or UI files do not prove rendered behavior.");
  }

  if (claimsRelease && !/\brollback|revert\b/i.test(packet.body)) {
    unverified.push("PR release/deploy claim remains unverified because rollback or revert proof is absent.");
    risk.push("PR release risk: readiness claim lacks rollback language or evidence.");
  }

  const hasReject = unverified.length > 0 && risk.length > 0;
  const hasReview = packet.reviewComments.some((comment) => comment.state !== "resolved");
  const verdict: PullRequestArtifactAuditResult["verdict"] =
    hasReview ? "human_review" : hasReject ? "reject" : weak.length > 0 ? "provisional" : "accept";

  return {
    verdict,
    verified: dedupe(verified),
    weak: dedupe(weak),
    unverified: dedupe(unverified),
    risk: dedupe(risk)
  };
}

function stripPrefix(text: string): string {
  return text.replace(/^PR artifact audit:\s*/i, "").replace(/\.$/, "");
}
