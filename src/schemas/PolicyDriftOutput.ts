import { z } from "zod";

export const POLICY_DRIFT_REQUIRED_HEADINGS = [
  "## Policy Change",
  "## Drift Checks",
  "## Violations",
  "## Required Evals",
  "## Approval Recommendation"
] as const;

export const PolicyDriftOutputSchema = z.object({
  policyChange: z.array(z.string()),
  driftChecks: z.array(z.string()),
  violations: z.array(z.string()),
  requiredEvals: z.array(z.string()),
  approvalRecommendation: z.enum(["approve", "reject", "needs_review"])
});

export type PolicyDriftOutput = z.infer<typeof PolicyDriftOutputSchema>;
