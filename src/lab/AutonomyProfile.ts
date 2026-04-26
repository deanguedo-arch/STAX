import { z } from "zod";
import {
  AutonomyProfileNameSchema,
  type AutonomyProfileName
} from "./LearningWorker.js";

export const AutonomyProfileSchema = z.object({
  name: AutonomyProfileNameSchema,
  canGenerateCurriculum: z.boolean(),
  canGenerateScenarios: z.boolean(),
  canRunScenarios: z.boolean(),
  canCreateCandidates: z.boolean(),
  canCreatePatchProposals: z.boolean(),
  canCreateHandoffs: z.boolean(),
  canRunVerification: z.boolean(),
  canAutoApplyLowRisk: z.boolean(),
  canAutoMerge: z.literal(false)
});

export type AutonomyProfile = z.infer<typeof AutonomyProfileSchema>;

const profiles: Record<AutonomyProfileName, AutonomyProfile> = {
  cautious: {
    name: "cautious",
    canGenerateCurriculum: true,
    canGenerateScenarios: true,
    canRunScenarios: true,
    canCreateCandidates: false,
    canCreatePatchProposals: false,
    canCreateHandoffs: false,
    canRunVerification: false,
    canAutoApplyLowRisk: false,
    canAutoMerge: false
  },
  balanced: {
    name: "balanced",
    canGenerateCurriculum: true,
    canGenerateScenarios: true,
    canRunScenarios: true,
    canCreateCandidates: true,
    canCreatePatchProposals: true,
    canCreateHandoffs: false,
    canRunVerification: false,
    canAutoApplyLowRisk: false,
    canAutoMerge: false
  },
  aggressive: {
    name: "aggressive",
    canGenerateCurriculum: true,
    canGenerateScenarios: true,
    canRunScenarios: true,
    canCreateCandidates: true,
    canCreatePatchProposals: true,
    canCreateHandoffs: true,
    canRunVerification: true,
    canAutoApplyLowRisk: false,
    canAutoMerge: false
  },
  experimental: {
    name: "experimental",
    canGenerateCurriculum: true,
    canGenerateScenarios: true,
    canRunScenarios: true,
    canCreateCandidates: true,
    canCreatePatchProposals: true,
    canCreateHandoffs: true,
    canRunVerification: true,
    canAutoApplyLowRisk: true,
    canAutoMerge: false
  }
};

export function getAutonomyProfile(
  name: string,
  options: { experimentalAutoApply?: boolean } = {}
): AutonomyProfile {
  const parsed = AutonomyProfileNameSchema.parse(name);
  if (parsed === "experimental" && !options.experimentalAutoApply) {
    throw new Error("Experimental lab autonomy is disabled by default. Set lab.experimentalAutoApply=true before using it.");
  }
  return AutonomyProfileSchema.parse(profiles[parsed]);
}

export function assertProfileAllows(profile: AutonomyProfile, capability: keyof AutonomyProfile): void {
  if (profile[capability] !== true) {
    throw new Error(`Autonomy profile ${profile.name} does not allow ${String(capability)}.`);
  }
}
