import { AgentRouter } from "../agents/AgentRouter.js";
import type { Agent } from "../agents/Agent.js";
import { createAgentSet } from "../agents/agentFactory.js";
import type { ModelProvider } from "../providers/ModelProvider.js";
import { createProvider } from "../providers/ProviderFactory.js";
import { DEFAULT_CONFIG, type RaxConfig } from "../schemas/Config.js";
import type { RaxOutput } from "../schemas/RaxOutput.js";
import type { RunTrace } from "../schemas/RunLog.js";
import { BoundaryDecision } from "../safety/BoundaryDecision.js";
import { RiskClassifier } from "../safety/RiskClassifier.js";
import { safeRedirect } from "../safety/SafeRedirect.js";
import { createRunId } from "../utils/ids.js";
import { validateModeOutput } from "../utils/validators.js";
import { ContextWindow } from "./ContextWindow.js";
import { loadConfig, mergeConfig } from "./ConfigLoader.js";
import { InstructionStack } from "./InstructionStack.js";
import { ResponsePipeline } from "./ResponsePipeline.js";
import { RunLogger } from "./RunLogger.js";
import { ValidationFailureError } from "./errors.js";

export type RaxRuntimeOptions = {
  rootDir?: string;
  provider?: ModelProvider;
  config?: Partial<RaxConfig>;
};

export class RaxRuntime {
  constructor(
    private rootDir: string,
    private config: RaxConfig,
    private provider: ModelProvider,
    private instructionStack: InstructionStack,
    private riskClassifier: RiskClassifier,
    private boundaryDecision: BoundaryDecision,
    private router: AgentRouter,
    private critic: Agent,
    private formatter: Agent,
    private logger: RunLogger,
    private contextWindow: ContextWindow,
    private pipeline: ResponsePipeline
  ) {}

  async run(input: string, context: string[] = []): Promise<RaxOutput> {
    const runId = createRunId();
    const createdAt = new Date().toISOString();
    const risk = this.riskClassifier.score(input);
    const boundary = this.boundaryDecision.decide(risk);
    const agentSequence: string[] = [];
    const modelCalls: RunTrace["modelCalls"] = [];
    let retries = 0;

    const boundaryStack = await this.instructionStack.build({
      userInput: input,
      mode: "analysis",
      retrievedContext: this.contextWindow.trim(context)
    });

    if (boundary.mode === "refuse" || boundary.mode === "redirect") {
      const final = safeRedirect(boundary.reason);
      const validation = { valid: true, issues: [] };
      const trace: RunTrace = {
        stack: boundaryStack.stack,
        agentSequence,
        riskScore: risk,
        boundaryDecision: boundary,
        modelCalls,
        validation,
        retries
      };

      const output: RaxOutput = {
        runId,
        mode: boundary.mode,
        taskMode: "boundary",
        agent: "boundary",
        risk,
        output: final,
        validation,
        versions: this.config.versions ?? DEFAULT_CONFIG.versions!,
        createdAt
      };

      await this.logger.log({
        runId,
        input,
        config: this.config,
        stack: boundaryStack.stack,
        risk,
        boundary,
        final,
        trace,
        createdAt
      });

      return output;
    }

    const route = this.router.route({
      input,
      riskLabels: risk.labels
    });
    const trimmedContext = this.contextWindow.trim(context);
    const stack = await this.instructionStack.build({
      userInput: input,
      mode: route.mode,
      retrievedContext: trimmedContext
    });

    const primary = await this.runAgent(route.agent, {
      input,
      system: stack.system,
      risk,
      context: trimmedContext,
      provider: this.provider,
      config: this.config,
      mode: route.mode
    }, agentSequence, modelCalls);

    const criticInput = [
      "Audit this agent output.",
      "",
      "## Original User Input",
      input,
      "",
      "## Primary Output",
      primary.output
    ].join("\n");

    const criticResult = await this.runAgent(this.critic, {
      input: criticInput,
      system: stack.system,
      risk,
      context: trimmedContext,
      provider: this.provider,
      config: this.config,
      mode: "audit"
    }, agentSequence, modelCalls);

    const formatterInput = [
      "Format the final output. Do not add new claims.",
      "",
      "## Original User Input",
      input,
      "",
      "## Primary Output",
      primary.output,
      "",
      "## Critic Review",
      criticResult.output
    ].join("\n");

    let formatterResult = await this.runAgent(this.formatter, {
      input: formatterInput,
      system: stack.system,
      risk,
      context: trimmedContext,
      provider: this.provider,
      config: this.config,
      mode: route.mode
    }, agentSequence, modelCalls);

    let validation = this.pipeline.validate(route.mode, formatterResult.output);

    if (!validation.valid) {
      retries += 1;
      formatterResult = await this.runAgent(this.formatter, {
        input: [
          formatterInput,
          "",
          "Schema validation failed. Return only corrected output matching the requested mode.",
          validation.issues.join("\n")
        ].join("\n"),
        system: stack.system,
        risk,
        context: trimmedContext,
        provider: this.provider,
        config: this.config,
        mode: route.mode
      }, agentSequence, modelCalls);
      validation = validateModeOutput(route.mode, formatterResult.output);
    }

    if (!validation.valid) {
      throw new ValidationFailureError(validation.issues.join("; "));
    }

    const trace: RunTrace = {
      stack: stack.stack,
      routingDecision: {
        agent: route.agent.name,
        mode: route.mode,
        reason: route.reason
      },
      agentSequence,
      riskScore: risk,
      boundaryDecision: boundary,
      modelCalls,
      validation,
      retries
    };

    const output: RaxOutput = {
      runId,
      mode: boundary.mode,
      taskMode: route.mode,
      agent: route.agent.name,
      risk,
      output: formatterResult.output,
      critic: criticResult.output,
      formatter: formatterResult.output,
      validation,
      versions: this.config.versions ?? DEFAULT_CONFIG.versions!,
      createdAt
    };

    await this.logger.log({
      runId,
      input,
      config: this.config,
      stack: stack.stack,
      risk,
      boundary,
      routing: trace.routingDecision,
      primary,
      critic: criticResult,
      final: formatterResult.output,
      trace,
      createdAt
    });

    return output;
  }

  private async runAgent(
    agent: Agent,
    input: Parameters<Agent["execute"]>[0],
    sequence: string[],
    modelCalls: RunTrace["modelCalls"]
  ) {
    sequence.push(agent.name);
    const before = Date.now();
    const result = await agent.execute(input);
    modelCalls.push({
      provider: this.provider.name,
      model: this.provider.model,
      latencyMs: Date.now() - before
    });
    return result;
  }
}

export async function createDefaultRuntime(
  options: RaxRuntimeOptions = {}
): Promise<RaxRuntime> {
  const rootDir = options.rootDir ?? process.cwd();
  const loaded = await loadConfig(rootDir, options.config);
  const config = mergeConfig(DEFAULT_CONFIG, loaded);
  const provider = options.provider ?? createProvider(config.provider);
  const agents = createAgentSet();
  const router = new AgentRouter({
    intake: agents.intake,
    analyst: agents.analyst,
    planner: agents.planner
  });

  return new RaxRuntime(
    rootDir,
    config,
    provider,
    new InstructionStack(rootDir),
    new RiskClassifier(),
    new BoundaryDecision(
      config.safety?.riskThresholdConstrain,
      config.safety?.riskThresholdRefuse
    ),
    router,
    agents.critic,
    agents.formatter,
    new RunLogger(rootDir),
    new ContextWindow(config.runtime.maxContextItems),
    new ResponsePipeline()
  );
}
