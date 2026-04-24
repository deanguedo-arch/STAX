import { loadMarkdown } from "../utils/loadMarkdown.js";
import { ConflictResolver } from "./ConflictResolver.js";
import type { PolicyBundle, PolicyCompileInput } from "./policyTypes.js";
import { PolicyLoader } from "./PolicyLoader.js";
import { PolicySelector } from "./PolicySelector.js";

export class PolicyCompiler {
  private resolver = new ConflictResolver();

  constructor(
    private loader: PolicyLoader,
    private selector: PolicySelector
  ) {}

  async compile(input: PolicyCompileInput): Promise<PolicyBundle> {
    const selected = this.resolver.resolve(this.selector.select(input));
    const loaded = await Promise.all(selected.map((policy) => this.loader.load(policy)));
    const modeContract = await loadMarkdown(`modes/${input.mode}.mode.md`, process.cwd());
    const examples = input.retrievedExamples
      .map((example) => `Input: ${example.input}\nIdeal Output:\n${example.idealOutput}`)
      .join("\n\n");
    const memory = input.retrievedMemory.map((item) => item.content).join("\n");

    const policiesApplied = loaded.map((policy) => `${policy.id}@${policy.version}`);
    const outputContract = `Mode: ${input.mode}\n${modeContract}`;

    return {
      policiesApplied,
      compiledSystemPrompt: [
        "# RAX Core",
        ...loaded.map((policy) => policy.content),
        "# Mode Contract",
        modeContract,
        examples ? `# Relevant Examples\n${examples}` : "",
        memory ? `# Retrieved Memory\n${memory}` : "",
        "# User Input",
        input.userInput
      ].filter(Boolean).join("\n\n"),
      outputContract,
      forbiddenBehaviors: [
        "invent facts",
        "claim unavailable capabilities",
        "auto-save raw model output",
        "ignore schema failure"
      ],
      requiredBehaviors: [
        "follow selected mode",
        "apply evidence labels",
        "log failures",
        "preserve uncertainty"
      ]
    };
  }
}
