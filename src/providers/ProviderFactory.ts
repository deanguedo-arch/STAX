import { MockProvider } from "./MockProvider.js";
import { OllamaProvider } from "./OllamaProvider.js";
import { OpenAIProvider } from "./OpenAIProvider.js";
import type { ModelProvider } from "./ModelProvider.js";

export type ProviderConfig = {
  type?: "mock" | "ollama" | "openai";
  model?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
};

export function createProvider(config: ProviderConfig = {}): ModelProvider {
  const type = config.type ?? "mock";

  if (type === "mock") {
    return new MockProvider();
  }

  if (type === "ollama") {
    return new OllamaProvider(
      config.ollamaBaseUrl ?? "http://localhost:11434",
      config.ollamaModel ?? config.model ?? "llama3.2"
    );
  }

  if (type === "openai") {
    if (!config.openaiApiKey) {
      throw new Error("OPENAI_API_KEY is required when RAX_PROVIDER=openai");
    }

    return new OpenAIProvider(
      config.openaiApiKey,
      config.openaiModel ?? config.model ?? "gpt-5.2"
    );
  }

  return new MockProvider();
}
