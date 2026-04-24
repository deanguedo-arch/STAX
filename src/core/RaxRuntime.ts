import { AgentRouter } from "../agents/AgentRouter.js";
import type { Agent } from "../agents/Agent.js";
import { createAgentSet } from "../agents/agentFactory.js";
import { DetailLevelController } from "../classifiers/DetailLevelController.js";
import { IntentClassifier } from "../classifiers/IntentClassifier.js";
import { ModeDetector } from "../classifiers/ModeDetector.js";
import { MemoryStore } from "../memory/MemoryStore.js";
import { PolicyCompiler } from "../policy/PolicyCompiler.js";
import { PolicyLoader } from "../policy/PolicyLoader.js";
import { PolicySelector } from "../policy/PolicySelector.js";
import type { ModelProvider } from "../providers/ModelProvider.js";
import { createProvider } from "../providers/ProviderFactory.js";
import { DEFAULT_CONFIG, type DeepPartial, type RaxConfig } from "../schemas/Config.js";
import type { DetailLevel, RaxMode } from "../schemas/Config.js";
import type { RaxOutput } from "../schemas/RaxOutput.js";
import type { ModelCallTrace, RunTrace } from "../schemas/RunLog.js";
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
  config?: DeepPartial<RaxConfig>;
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
    private pipeline: ResponsePipeline,
    private modeDetector = new ModeDetector(),
    private detailLevelController = new DetailLevelController(),
    private policyCompiler = new PolicyCompiler(new PolicyLoader(rootDir), new PolicySelector())
  ) {}

  async run(
    input: string,
    context: string[] = [],
    options: { mode?: RaxMode; detailLevel?: DetailLevel } = {}
  ): Promise<RaxOutput> {
    const runId = createRunId();
    const createdAt = new Date().toISOString();
    const startedAt = Date.now();
    const intent = new IntentClassifier().classify(input);
    const risk = this.riskClassifier.score(input);
    const boundary = this.boundaryDecision.decide(risk);
    const agentSequence: string[] = [];
    const modelCalls: ModelCallTrace[] = [];
    let retries = 0;
    const detectedMode = this.modeDetector.detect(input);
    const effectiveMode = options.mode ?? detectedMode.mode;
    const detailLevel =
      options.detailLevel ?? this.detailLevelController.select(effectiveMode, boundary.mode);
    const retrievedMemory = (await new MemoryStore(this.rootDir).search(input)).slice(
      0,
      this.config.memory.maxMemoryResults
    );
    const policyBundle = await this.policyCompiler.compile({
      mode: effectiveMode,
      risk,
      boundaryMode: boundary.mode,
      userInput: input,
      retrievedMemory,
      retrievedExamples: []
    });

    const boundaryStack = await this.instructionStack.build({
      userInput: input,
      mode: effectiveMode,
      retrievedContext: this.contextWindow.trim(context)
    });

    if (boundary.mode === "refuse" || boundary.mode === "redirect") {
      const final = safeRedirect(boundary.reason);
      const validation = { valid: true, issues: [] };
      const trace: RunTrace = {
        runId,
        createdAt,
        runtimeVersion: this.config.runtime.version,
        provider: this.provider.name,
        model: this.provider.model,
        criticModel: this.config.model.criticModel,
        temperature: this.config.model.generationTemperature,
        criticTemperature: this.config.model.criticTemperature,
        topP: this.config.model.topP,
        seed: this.config.model.seed,
        mode: effectiveMode,
        modeConfidence: detectedMode.confidence,
        boundaryMode: boundary.mode,
        selectedAgent: "boundary",
        policiesApplied: policyBundle.policiesApplied,
        criticPasses: 0,
        repairPasses: 0,
        formatterPasses: 0,
        schemaRetries: 0,
        latencyMs: Date.now() - startedAt,
        toolCalls: [],
        errors: [],
        detailLevel,
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
        versions: {
          runtime: this.config.runtime.version,
          schema: "v1",
          prompts: "v1"
        },
        createdAt
      };

      await this.logger.log({
        runId,
        input,
        config: this.config,
        stack: boundaryStack.stack,
        intent,
        risk,
        boundary,
        mode: { ...detectedMode, mode: effectiveMode },
        policyBundle,
        retrievedMemory,
        retrievedExamples: [],
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
    const effectiveRoute = options.mode
      ? { ...route, mode: options.mode, agent: this.router.agentForMode(options.mode) }
      : route;
    const trimmedContext = this.contextWindow.trim(context);
    const stack = await this.instructionStack.build({
      userInput: input,
      mode: effectiveRoute.mode,
      retrievedContext: trimmedContext
    });

    const primary = await this.runAgent(effectiveRoute.agent, {
      input,
      system: stack.system,
      risk,
      context: trimmedContext,
      provider: this.provider,
      config: this.config,
      mode: effectiveRoute.mode,
      policyBundle,
      boundary,
      memory: retrievedMemory,
      examples: [],
      detailLevel
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
      mode: "audit",
      policyBundle,
      boundary,
      memory: retrievedMemory,
      examples: [],
      detailLevel
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
      mode: effectiveRoute.mode,
      policyBundle,
      boundary,
      memory: retrievedMemory,
      examples: [],
      detailLevel
    }, agentSequence, modelCalls);

    let validation = this.pipeline.validate(effectiveRoute.mode, formatterResult.output);

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
        mode: effectiveRoute.mode,
        policyBundle,
        boundary,
        memory: retrievedMemory,
        examples: [],
        detailLevel
      }, agentSequence, modelCalls);
      validation = validateModeOutput(effectiveRoute.mode, formatterResult.output);
    }

    if (!validation.valid) {
      throw new ValidationFailureError(validation.issues.join("; "));
    }

    const trace: RunTrace = {
      runId,
      createdAt,
      runtimeVersion: this.config.runtime.version,
      provider: this.provider.name,
      model: this.provider.model,
      criticModel: this.config.model.criticModel,
      temperature: this.config.model.generationTemperature,
      criticTemperature: this.config.model.criticTemperature,
      topP: this.config.model.topP,
      seed: this.config.model.seed,
      mode: effectiveRoute.mode,
      modeConfidence: detectedMode.confidence,
      boundaryMode: boundary.mode,
      selectedAgent: effectiveRoute.agent.name,
      policiesApplied: policyBundle.policiesApplied,
      criticPasses: 1,
      repairPasses: 0,
      formatterPasses: 1,
      schemaRetries: retries,
      latencyMs: Date.now() - startedAt,
      toolCalls: [],
      errors: [],
      detailLevel,
      stack: stack.stack,
      routingDecision: {
        agent: effectiveRoute.agent.name,
        mode: effectiveRoute.mode,
        reason: route.reason,
        modeConfidence: detectedMode.confidence,
        matchedTerms: detectedMode.matchedTerms,
        detailLevel,
        policiesApplied: policyBundle.policiesApplied
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
      taskMode: effectiveRoute.mode,
      agent: effectiveRoute.agent.name,
      risk,
      output: formatterResult.output,
      critic: criticResult.output,
      formatter: formatterResult.output,
      validation,
      versions: {
        runtime: this.config.runtime.version,
        schema: "v1",
        prompts: "v1"
      },
      createdAt
    };

    await this.logger.log({
      runId,
      input,
      config: this.config,
      stack: stack.stack,
      intent,
      risk,
      boundary,
      mode: { ...detectedMode, mode: effectiveRoute.mode },
      policyBundle,
      retrievedMemory,
      retrievedExamples: [],
      routing: trace.routingDecision,
      primary,
      critic: criticResult,
      formatter: formatterResult.output,
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
    modelCalls: ModelCallTrace[]
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
  const provider = options.provider ?? createProvider(config.model);
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
      config.risk.constrainThreshold,
      config.risk.refuseThreshold
    ),
    router,
    agents.critic,
    agents.formatter,
    new RunLogger(rootDir),
    new ContextWindow(config.limits.maxRetrievedMemories),
    new ResponsePipeline()
  );
}
