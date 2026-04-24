export type ProviderType = "mock" | "ollama" | "openai";
export type ProviderRole = "generator" | "critic" | "evaluator" | "classifier" | "formatter";
export type ClassifierProviderType = ProviderType | "rules";

export type RaxMode =
  | "intake"
  | "analysis"
  | "planning"
  | "audit"
  | "stax_fitness"
  | "code_review"
  | "teaching"
  | "general_chat";

export type Mode = RaxMode;

export type DetailLevel = "minimal" | "brief" | "standard" | "deep" | "surgical";

export type RaxConfig = {
  runtime: {
    version: string;
    name: string;
    defaultMode: RaxMode;
    strictMode: boolean;
    requirePolicyCompilation: boolean;
    requireSchemaValidation: boolean;
    requireCriticPass: boolean;
    requireFormatterPass: boolean;
    requireTraceLog: boolean;
    requireReplayData: boolean;
    logRuns: boolean;
    replayEnabled: boolean;
  };
  model: {
    provider: ProviderType;
    generatorProvider: ProviderType;
    criticProvider: ProviderType;
    evaluatorProvider: ProviderType;
    classifierProvider: ClassifierProviderType;
    generationModel: string;
    criticModel: string;
    evaluatorModel: string;
    classifierModel: string;
    generationTemperature: number;
    criticTemperature: number;
    evalTemperature: number;
    topP: number;
    seed: number;
    maxOutputTokens: number;
    timeoutMs: number;
    ollamaBaseUrl: string;
    ollamaModel: string;
    openaiModel: string;
    openaiApiKey?: string;
  };
  limits: {
    maxAgentsPerRun: number;
    maxToolCallsPerRun: number;
    maxCriticPasses: number;
    maxRepairPasses: number;
    maxSchemaRetries: number;
    maxRetrievedMemories: number;
    maxRetrievedExamples: number;
    maxPolicyTokens: number;
    maxInputChars: number;
    maxBatchFiles: number;
  };
  risk: {
    scale: "0-3";
    constrainThreshold: number;
    refuseThreshold: number;
    hardStops: {
      privacy: number;
      systemIntegrity: number;
      exploitation: number;
      actionableHarm: {
        harm: number;
        actionability: number;
      };
    };
    regulatedAdviceConstrainScore: number;
  };
  evals: {
    minimumPassRate: number;
    criticalEvalPassRequired: boolean;
    regressionTolerance: number;
    goldenSimilarityWarning: number;
    goldenSimilarityFail: number;
    propertyEvalRequired: boolean;
  };
  memory: {
    autoSaveModelOutputs: boolean;
    requireUserApprovedMemory: boolean;
    defaultExpirationDays: number;
    correctionsNeverExpire: boolean;
    maxMemoryResults: number;
  };
  tools: {
    fileRead: "allowed" | "disabled";
    fileWrite: "allowed" | "disabled";
    shell: "allowed" | "disabled";
    web: "allowed" | "disabled";
    git: "approval_required" | "disabled" | "allowed";
  };
  training: {
    enableSftExport: boolean;
    enablePreferenceExport: boolean;
    enableCorrectionExport: boolean;
    autoPromoteCorrectionsToTraining: boolean;
  };
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export const DEFAULT_CONFIG: RaxConfig = {
  runtime: {
    version: "0.1.0",
    name: "STAX/RAX",
    defaultMode: "analysis",
    strictMode: true,
    requirePolicyCompilation: true,
    requireSchemaValidation: true,
    requireCriticPass: true,
    requireFormatterPass: true,
    requireTraceLog: true,
    requireReplayData: true,
    logRuns: true,
    replayEnabled: true
  },
  model: {
    provider: "mock",
    generatorProvider: "mock",
    criticProvider: "mock",
    evaluatorProvider: "mock",
    classifierProvider: "rules",
    generationModel: "mock-generator",
    criticModel: "mock-critic",
    evaluatorModel: "mock-evaluator",
    classifierModel: "rules",
    generationTemperature: 0.2,
    criticTemperature: 0.0,
    evalTemperature: 0.0,
    topP: 0.9,
    seed: 42,
    maxOutputTokens: 2000,
    timeoutMs: 20000,
    ollamaBaseUrl: "http://localhost:11434",
    ollamaModel: "llama3.2",
    openaiModel: "gpt-5.2"
  },
  limits: {
    maxAgentsPerRun: 3,
    maxToolCallsPerRun: 5,
    maxCriticPasses: 1,
    maxRepairPasses: 1,
    maxSchemaRetries: 1,
    maxRetrievedMemories: 5,
    maxRetrievedExamples: 4,
    maxPolicyTokens: 2500,
    maxInputChars: 20000,
    maxBatchFiles: 50
  },
  risk: {
    scale: "0-3",
    constrainThreshold: 5,
    refuseThreshold: 8,
    hardStops: {
      privacy: 3,
      systemIntegrity: 3,
      exploitation: 3,
      actionableHarm: {
        harm: 3,
        actionability: 2
      }
    },
    regulatedAdviceConstrainScore: 2
  },
  evals: {
    minimumPassRate: 0.9,
    criticalEvalPassRequired: true,
    regressionTolerance: 0.05,
    goldenSimilarityWarning: 0.75,
    goldenSimilarityFail: 0.6,
    propertyEvalRequired: true
  },
  memory: {
    autoSaveModelOutputs: false,
    requireUserApprovedMemory: true,
    defaultExpirationDays: 90,
    correctionsNeverExpire: true,
    maxMemoryResults: 5
  },
  tools: {
    fileRead: "allowed",
    fileWrite: "disabled",
    shell: "disabled",
    web: "disabled",
    git: "approval_required"
  },
  training: {
    enableSftExport: true,
    enablePreferenceExport: true,
    enableCorrectionExport: true,
    autoPromoteCorrectionsToTraining: false
  }
};
