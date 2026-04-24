import { describe, expect, it } from "vitest";
import { createProvider } from "../src/providers/ProviderFactory.js";
import { MockProvider } from "../src/providers/MockProvider.js";
import { ProviderRouter } from "../src/routing/ProviderRouter.js";
import { DEFAULT_CONFIG } from "../src/schemas/Config.js";

describe("ProviderFactory", () => {
  it("creates the mock provider by default", () => {
    const provider = createProvider({ type: "mock" });

    expect(provider).toBeInstanceOf(MockProvider);
  });

  it("does not require an OpenAI key for mock mode", () => {
    expect(() => createProvider({ type: "mock" })).not.toThrow();
  });

  it("requires an OpenAI key only for openai mode", () => {
    expect(() => createProvider({ type: "openai" })).toThrow(
      /OPENAI_API_KEY/
    );
  });

  it("creates Ollama provider objects without a network call", () => {
    const provider = createProvider({ provider: "ollama" });

    expect(provider.name).toBe("ollama");
  });

  it("routes critic and evaluator roles to mock by default", () => {
    const router = new ProviderRouter(DEFAULT_CONFIG);

    expect(router.generator().name).toBe("mock");
    expect(router.critic().name).toBe("mock");
    expect(router.evaluator().name).toBe("mock");
    expect(router.classifier()).toBe("rules");
  });
});
