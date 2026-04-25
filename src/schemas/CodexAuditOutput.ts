import { z } from "zod";

export const CODEX_AUDIT_REQUIRED_HEADINGS = [
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
