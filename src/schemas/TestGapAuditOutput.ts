import { z } from "zod";

export const TEST_GAP_AUDIT_REQUIRED_HEADINGS = [
  "## Feature",
  "## Existing Tests",
  "## Missing Tests",
  "## Negative Cases Needed",
  "## Eval Cases Needed",
  "## Priority"
] as const;

export const TestGapAuditOutputSchema = z.object({
  feature: z.string().min(1),
  existingTests: z.array(z.string()),
  missingTests: z.array(z.string()),
  negativeCasesNeeded: z.array(z.string()),
  evalCasesNeeded: z.array(z.string()),
  priority: z.enum(["low", "medium", "high"])
});

export type TestGapAuditOutput = z.infer<typeof TestGapAuditOutputSchema>;
