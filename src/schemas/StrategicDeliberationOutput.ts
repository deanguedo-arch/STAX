import { z } from "zod";

export const STRATEGIC_DELIBERATION_REQUIRED_HEADINGS = [
  "## Strategic Question",
  "## Capability Warning",
  "## Options Considered",
  "## Best Option",
  "## Why This Beats The Alternatives",
  "## Red-Team Failure Modes",
  "## Opportunity Cost",
  "## Reversibility",
  "## Evidence Used",
  "## Evidence Missing",
  "## Decision",
  "## Next Proof Step",
  "## Kill Criteria"
] as const;

export const StrategicDeliberationOutputSchema = z.object({
  strategicQuestion: z.array(z.string()),
  capabilityWarning: z.array(z.string()),
  optionsConsidered: z.array(z.string()),
  bestOption: z.array(z.string()),
  whyThisBeatsTheAlternatives: z.array(z.string()),
  redTeamFailureModes: z.array(z.string()),
  opportunityCost: z.array(z.string()),
  reversibility: z.array(z.string()),
  evidenceUsed: z.array(z.string()),
  evidenceMissing: z.array(z.string()),
  decision: z.array(z.string()),
  nextProofStep: z.array(z.string()),
  killCriteria: z.array(z.string())
});

export type StrategicDeliberationOutput = z.infer<typeof StrategicDeliberationOutputSchema>;
