import type { RaxConfig } from "../schemas/Config.js";
import { createProvider } from "../providers/ProviderFactory.js";
import { MockProvider } from "../providers/MockProvider.js";

export class ProviderRouter {
  constructor(private config: RaxConfig) {}

  generator() {
    return createProvider(this.config.model);
  }

  critic() {
    return new MockProvider();
  }

  evaluator() {
    return new MockProvider();
  }

  classifier() {
    return "rules";
  }
}
