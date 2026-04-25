import { z } from "zod";

export const PROMPT_FACTORY_REQUIRED_HEADINGS = [
  "## Objective",
  "## Files To Inspect",
  "## Files To Modify",
  "## Tests To Add",
  "## Commands To Run",
  "## Acceptance Criteria",
  "## Stop Conditions",
  "## Final Report Required"
] as const;

export const PromptFactoryOutputSchema = z.object({
  objective: z.string().min(1),
  filesToInspect: z.array(z.string()),
  filesToModify: z.array(z.string()),
  testsToAdd: z.array(z.string()),
  commandsToRun: z.array(z.string()).min(1),
  acceptanceCriteria: z.array(z.string()).min(1),
  stopConditions: z.array(z.string()).min(1),
  finalReportRequired: z.array(z.string()).min(1)
});

export type PromptFactoryOutput = z.infer<typeof PromptFactoryOutputSchema>;
