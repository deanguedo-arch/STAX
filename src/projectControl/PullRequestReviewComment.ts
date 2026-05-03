import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { auditPullRequestArtifact, suggestPullRequestComment, type PullRequestArtifactAuditResult } from "./PullRequestArtifactAudit.js";
import { PullRequestArtifactPacketSchema, type PullRequestArtifactPacket } from "./PullRequestArtifactPacket.js";

export type PullRequestReviewCommentExpectation = {
  mustInclude: string[];
  forbiddenPhrases?: string[];
};

export type PullRequestReviewCommentCase = {
  caseId: string;
  task: string;
  expectedBranch?: string;
  expectedCommitSha?: string;
  packet: PullRequestArtifactPacket;
  expectation: PullRequestReviewCommentExpectation;
};

export type PullRequestReviewCommentScore = {
  caseId: string;
  passed: boolean;
  issues: string[];
  comment: string;
  verdict: PullRequestArtifactAuditResult["verdict"];
};

const PullRequestReviewCommentCaseSchema = z.object({
  caseId: z.string().min(1),
  task: z.string().min(1),
  expectedBranch: z.string().min(1).optional(),
  expectedCommitSha: z.string().min(1).optional(),
  packet: PullRequestArtifactPacketSchema,
  expectation: z.object({
    mustInclude: z.array(z.string().min(1)).min(1),
    forbiddenPhrases: z.array(z.string().min(1)).optional()
  })
});

const PullRequestReviewCommentCasesSchema = z.array(PullRequestReviewCommentCaseSchema);

export function generatePullRequestReviewComment(args: {
  task: string;
  packet: PullRequestArtifactPacket;
  expectedBranch?: string;
  expectedCommitSha?: string;
}): { comment: string; audit: PullRequestArtifactAuditResult } {
  const audit = auditPullRequestArtifact(args);
  const comment = suggestPullRequestComment({
    packet: args.packet,
    audit
  });
  return { comment, audit };
}

export function scorePullRequestReviewComment(input: PullRequestReviewCommentCase): PullRequestReviewCommentScore {
  const { comment, audit } = generatePullRequestReviewComment(input);
  const lower = comment.toLowerCase();
  const issues: string[] = [];

  for (const phrase of input.expectation.mustInclude) {
    if (!lower.includes(phrase.toLowerCase())) {
      issues.push(`missing required phrase: ${phrase}`);
    }
  }
  for (const phrase of input.expectation.forbiddenPhrases ?? ["lgtm", "ship it", "approve this", "merge this", "fix everything"]) {
    if (lower.includes(phrase.toLowerCase())) {
      issues.push(`forbidden phrase present: ${phrase}`);
    }
  }
  if (!/\bplease\b/i.test(comment)) {
    issues.push("comment does not ask for a bounded next action");
  }
  if (!/[.!?]$/.test(comment.trim())) {
    issues.push("comment should end cleanly");
  }

  return {
    caseId: input.caseId,
    passed: issues.length === 0,
    issues,
    comment,
    verdict: audit.verdict
  };
}

export function loadPullRequestReviewCommentCases(rootDir = process.cwd()): PullRequestReviewCommentCase[] {
  const filePath = join(rootDir, "fixtures", "pr_review_comment", "pr_review_comment_15_cases.json");
  return PullRequestReviewCommentCasesSchema.parse(JSON.parse(readFileSync(filePath, "utf8")));
}
