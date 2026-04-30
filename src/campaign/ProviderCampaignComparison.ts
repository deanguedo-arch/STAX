export type CampaignSnapshot = {
  campaignStatus: "real_use_candidate" | "real_use_useful" | "real_use_not_proven";
  provider: {
    generator: string;
    critic: string;
    evaluator: string;
  };
  taskCount: number;
  usefulSessions: number;
  totalCleanupPromptsNeeded: number;
  fakeCompleteChecks: number;
  fakeCompleteCaught: number;
  uniqueOneNextActions: number;
  uniqueOutputShapes: number;
};

export type ProviderComparisonStatus =
  | "provider_improved"
  | "provider_parity"
  | "provider_regression"
  | "provider_run_blocked";

export type ProviderCampaignComparison = {
  status: ProviderComparisonStatus;
  mock: CampaignSnapshot;
  provider: CampaignSnapshot | null;
  deltas: {
    usefulSessionsDelta: number;
    cleanupDelta: number;
    fakeCompleteDelta: number;
    uniqueActionsDelta: number;
    uniqueShapesDelta: number;
  };
  notes: string[];
};

export function compareProviderCampaigns(
  mock: CampaignSnapshot,
  provider: CampaignSnapshot | null
): ProviderCampaignComparison {
  if (!provider) {
    return {
      status: "provider_run_blocked",
      mock,
      provider: null,
      deltas: {
        usefulSessionsDelta: 0,
        cleanupDelta: 0,
        fakeCompleteDelta: 0,
        uniqueActionsDelta: 0,
        uniqueShapesDelta: 0
      },
      notes: [
        "Provider campaign did not execute. Keep phase status as candidate-only until a non-mock run is available."
      ]
    };
  }

  const deltas = {
    usefulSessionsDelta: provider.usefulSessions - mock.usefulSessions,
    cleanupDelta: provider.totalCleanupPromptsNeeded - mock.totalCleanupPromptsNeeded,
    fakeCompleteDelta: provider.fakeCompleteCaught - mock.fakeCompleteCaught,
    uniqueActionsDelta: provider.uniqueOneNextActions - mock.uniqueOneNextActions,
    uniqueShapesDelta: provider.uniqueOutputShapes - mock.uniqueOutputShapes
  };

  const notes: string[] = [];
  const specificityImproved =
    deltas.uniqueActionsDelta > 0 || deltas.uniqueShapesDelta > 0;
  const cleanupImproved = deltas.cleanupDelta < 0;
  const safetyRegressed =
    deltas.fakeCompleteDelta < 0 ||
    provider.totalCleanupPromptsNeeded > mock.totalCleanupPromptsNeeded;

  if (provider.provider.generator === "mock") {
    notes.push("Provider run resolved to mock; non-mock comparison not proven.");
  }
  if (specificityImproved) {
    notes.push("Provider run increased specificity diversity across the same 10 tasks.");
  }
  if (cleanupImproved) {
    notes.push("Provider run reduced cleanup burden across the same 10 tasks.");
  }
  if (!specificityImproved && !cleanupImproved) {
    notes.push("Provider run reached parity but did not improve specificity or cleanup burden.");
  }
  if (safetyRegressed) {
    notes.push("Provider run regressed fake-complete catches or cleanup burden.");
  }

  let status: ProviderComparisonStatus = "provider_parity";
  if (safetyRegressed) {
    status = "provider_regression";
  } else if (specificityImproved || cleanupImproved) {
    status = "provider_improved";
  }

  return {
    status,
    mock,
    provider,
    deltas,
    notes
  };
}
