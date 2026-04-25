import { z } from "zod";

export const PROJECT_BRAIN_REQUIRED_HEADINGS = [
  "## Project State",
  "## Current Objective",
  "## Proven Working",
  "## Unproven Claims",
  "## Recent Changes",
  "## Known Failures",
  "## Risk Register",
  "## Missing Tests",
  "## Fake-Complete Risks",
  "## Next 3 Actions",
  "## Codex Prompt",
  "## Evidence Required"
] as const;

export const ProjectBrainOutputSchema = z.object({
  projectState: z.array(z.string()),
  currentObjective: z.array(z.string()),
  provenWorking: z.array(z.string()),
  unprovenClaims: z.array(z.string()),
  recentChanges: z.array(z.string()),
  knownFailures: z.array(z.string()),
  riskRegister: z.array(z.string()),
  missingTests: z.array(z.string()),
  fakeCompleteRisks: z.array(z.string()),
  next3Actions: z.array(z.string()).min(1).max(3),
  codexPrompt: z.string().min(1),
  evidenceRequired: z.array(z.string()).min(1)
});

export type ProjectBrainOutput = z.infer<typeof ProjectBrainOutputSchema>;
