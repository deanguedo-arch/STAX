import type { ProviderRole, RaxConfig } from "../schemas/Config.js";
import { createProvider } from "../providers/ProviderFactory.js";
import { MockProvider } from "../providers/MockProvider.js";
import type { ModelProvider } from "../providers/ModelProvider.js";

export type ProviderRoute = {
  role: ProviderRole;
  provider: string;
  model: string;
};

export class ProviderRouter {
  constructor(private config: RaxConfig) {}

  generator() {
    return this.providerFor("generator");
  }

  critic() {
    return this.providerFor("critic");
  }

  evaluator() {
    return this.providerFor("evaluator");
  }

  classifier() {
    return this.config.model.classifierProvider === "rules"
      ? "rules"
      : this.providerFor("classifier");
  }

  formatter() {
    return this.generator();
  }

  routes(): Record<"generator" | "critic" | "evaluator" | "classifier", string> {
    return {
      generator: this.config.model.generatorProvider,
      critic: this.config.model.criticProvider,
      evaluator: this.config.model.evaluatorProvider,
      classifier: this.config.model.classifierProvider
    };
  }

  private providerFor(role: ProviderRole): ModelProvider {
    const provider =
      role === "critic"
        ? this.config.model.criticProvider
        : role === "evaluator"
          ? this.config.model.evaluatorProvider
          : role === "classifier"
            ? this.config.model.classifierProvider
            : this.config.model.generatorProvider;

    if (provider === "rules") {
      return new MockProvider();
    }

    return createProvider({
      ...this.config.model,
      provider
    });
  }
}
