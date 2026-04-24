export type ProviderType = "mock" | "ollama" | "openai";

export type Mode = "intake" | "analysis" | "planning" | "audit" | "stax_fitness";

export type RaxConfig = {
  name?: string;
  version?: string;
  provider: {
    type: ProviderType;
    model?: string;
    temperature?: number;
    top_p?: number;
    seed?: number;
    maxTokens?: number;
    ollamaBaseUrl?: string;
    ollamaModel?: string;
    openaiApiKey?: string;
    openaiModel?: string;
  };
  runtime: {
    defaultMode?: Mode | "safe_helpful";
    logRuns?: boolean;
    maxContextItems?: number;
    requireCriticPass?: boolean;
    requireFormatterPass?: boolean;
  };
  limits: {
    maxAgents?: number;
    maxTokensPerRun?: number;
    maxCriticPasses?: number;
    timeoutMs?: number;
  };
  versions?: {
    prompts: string;
    schema: string;
    runtime: string;
  };
  memory?: {
    session?: boolean;
    project?: boolean;
    retrieval?: boolean;
    vectorRetrieval?: boolean;
  };
  tools?: {
    fileRead?: boolean;
    fileWrite?: boolean;
    search?: boolean;
    shell?: boolean;
  };
  safety?: {
    riskThresholdConstrain?: number;
    riskThresholdRefuse?: number;
  };
};

export const DEFAULT_CONFIG: RaxConfig = {
  name: "RAX",
  version: "0.1.0",
  provider: {
    type: "mock",
    model: "mock-model",
    temperature: 0.2,
    top_p: 1,
    seed: 1,
    maxTokens: 2000,
    ollamaBaseUrl: "http://localhost:11434",
    ollamaModel: "llama3.2",
    openaiModel: "gpt-5.2"
  },
  runtime: {
    defaultMode: "safe_helpful",
    logRuns: true,
    maxContextItems: 12,
    requireCriticPass: true,
    requireFormatterPass: true
  },
  limits: {
    maxAgents: 4,
    maxTokensPerRun: 4000,
    maxCriticPasses: 1,
    timeoutMs: 10000
  },
  versions: {
    prompts: "v1",
    schema: "v1",
    runtime: "v0.1.0"
  },
  memory: {
    session: true,
    project: true,
    retrieval: true,
    vectorRetrieval: false
  },
  tools: {
    fileRead: true,
    fileWrite: false,
    search: true,
    shell: false
  },
  safety: {
    riskThresholdConstrain: 5,
    riskThresholdRefuse: 8
  }
};
