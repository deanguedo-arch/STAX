import { describe, expect, it } from "vitest";
import { createProvider } from "../src/providers/ProviderFactory.js";
import { MockProvider } from "../src/providers/MockProvider.js";

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
});
