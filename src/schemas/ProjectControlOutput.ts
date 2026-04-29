import { z } from "zod";

export const PROJECT_CONTROL_REQUIRED_HEADINGS = [
  "## Verdict",
  "## Verified",
  "## Weak / Provisional",
  "## Unverified",
  "## Risk",
  "## One Next Action",
  "## Codex Prompt if needed"
] as const;

export const ProjectControlOutputSchema = z.object({
  verdict: z.string().min(1),
  verified: z.array(z.string()),
  weakOrProvisional: z.array(z.string()),
  unverified: z.array(z.string()),
  risk: z.array(z.string()),
  oneNextAction: z.string().min(1),
  codexPromptIfNeeded: z.string().optional()
});

export type ProjectControlOutput = z.infer<typeof ProjectControlOutputSchema>;
