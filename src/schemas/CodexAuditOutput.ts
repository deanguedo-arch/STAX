import { z } from "zod";

export const CODEX_AUDIT_REQUIRED_HEADINGS = [
  "## Audit Type",
  "## Evidence Checked",
  "## Claims Verified",
  "## Claims Not Verified",
  "## Risks",
  "## Required Next Proof",
  "## Recommendation",
  "## Evidence Decision",
  "## Codex Claim",
  "## Evidence Found",
  "## Missing Evidence",
  "## Files Modified",
  "## Tests Added",
  "## Commands Run",
  "## Violations",
  "## Fake-Complete Flags",
  "## Required Fix Prompt",
  "## Approval Recommendation"
] as const;

export const CodexAuditOutputSchema = z.object({
  auditType: z.enum(["Verified Audit", "Partial Audit", "Reasoned Opinion"]),
  evidenceChecked: z.array(z.string()),
  claimsVerified: z.array(z.string()),
  claimsNotVerified: z.array(z.string()),
  risks: z.array(z.string()),
  requiredNextProof: z.array(z.string()),
  recommendation: z.string().min(1),
  evidenceDecision: z.array(z.string()).optional(),
  codexClaim: z.array(z.string()),
  evidenceFound: z.array(z.string()),
  missingEvidence: z.array(z.string()),
  filesModified: z.array(z.string()),
  testsAdded: z.array(z.string()),
  commandsRun: z.array(z.string()),
  violations: z.array(z.string()),
  fakeCompleteFlags: z.array(z.string()),
  requiredFixPrompt: z.string().min(1),
  approvalRecommendation: z.enum(["approve", "reject", "needs_review"])
});

export type CodexAuditOutput = z.infer<typeof CodexAuditOutputSchema>;
