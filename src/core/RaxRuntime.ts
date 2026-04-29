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
import { CommandEvidenceStore } from "../evidence/CommandEvidenceStore.js";
import { EvidenceGroundingGate } from "../evidence/EvidenceGroundingGate.js";
import { ProviderRouter } from "../routing/ProviderRouter.js";
import { DEFAULT_CONFIG, type DeepPartial, type RaxConfig } from "../schemas/Config.js";
import type { DetailLevel, RaxMode } from "../schemas/Config.js";
import { modelCriticIssuesFromReview, parseModelCriticReview } from "../schemas/ModelCriticReview.js";
import type { RaxOutput } from "../schemas/RaxOutput.js";
import type { ModelCallTrace, RunTrace } from "../schemas/RunLog.js";
import { BoundaryDecision } from "../safety/BoundaryDecision.js";
import { RiskClassifier } from "../safety/RiskClassifier.js";
import { safeRedirect } from "../safety/SafeRedirect.js";
import { createRunId } from "../utils/ids.js";
import { validateModeOutput } from "../utils/validators.js";
import { CriticGate, type CriticReview } from "../validators/CriticGate.js";
import { RepairController, type RepairResult } from "../validators/RepairController.js";
import { RepoEvidencePackBuilder } from "../workspace/RepoEvidencePack.js";
import type { RepoEvidencePack } from "../workspace/RepoEvidenceSchemas.js";
import { ContextWindow } from "./ContextWindow.js";
import { loadConfig, mergeConfig } from "./ConfigLoader.js";
import { InstructionStack } from "./InstructionStack.js";
import { ResponsePipeline } from "./ResponsePipeline.js";
import { RunLogger } from "./RunLogger.js";
import { ValidationFailureError } from "./errors.js";

export type RaxRuntimeOptions = {
  rootDir?: string;
  provider?: ModelProvider;
  roleProviders?: Partial<Record<"generator" | "critic" | "formatter" | "evaluator", ModelProvider>>;
  config?: DeepPartial<RaxConfig>;
};

export type RaxRunOptions = {
  mode?: RaxMode;
  detailLevel?: DetailLevel;
  workspace?: string;
  linkedRepoPath?: string;
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
    private policyCompiler = new PolicyCompiler(new PolicyLoader(rootDir), new PolicySelector()),
    private roleProviders: Partial<Record<"generator" | "critic" | "formatter" | "evaluator", ModelProvider>> = {}
  ) {}

  async run(
    input: string,
    context: string[] = [],
    options: RaxRunOptions = {}
  ): Promise<RaxOutput> {
    const runId = createRunId();
    const createdAt = new Date().toISOString();
    const startedAt = Date.now();
    const intent = new IntentClassifier().classify(input);
    const detectedMode = this.modeDetector.detect(input);
    const effectiveMode = options.mode ?? detectedMode.mode;
    const risk = this.riskClassifier.score(input);
    const boundary = this.boundaryDecision.decide(risk, { mode: effectiveMode, input });
    const agentSequence: string[] = [];
    const modelCalls: ModelCallTrace[] = [];
    let retries = 0;
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
    const providerRoles = {
      generator: this.providerForRole("generator").name,
      critic: this.providerForRole("critic").name,
      evaluator: this.providerForRole("evaluator").name,
      classifier: this.config.model.classifierProvider
    };

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
        workspace: options.workspace,
        linkedRepoPath: options.linkedRepoPath,
        runtimeVersion: this.config.runtime.version,
        provider: this.provider.name,
        model: this.provider.model,
        providerRoles,
        criticModel: this.config.model.criticModel,
        evaluatorModel: this.config.model.evaluatorModel,
        classifierModel: this.config.model.classifierModel,
        temperature: this.config.model.generationTemperature,
        criticTemperature: this.config.model.criticTemperature,
        evalTemperature: this.config.model.evalTemperature,
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
        route: { agent: "boundary", mode: "boundary" },
        replayable: this.provider.name === "mock",
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
    const repoEvidencePack = await this.collectRepoEvidencePack(effectiveRoute.mode, options);
    const contextWithEvidence = repoEvidencePack ? [...context, repoEvidencePack.markdown] : context;
    const trimmedContext = this.contextWindow.trim(contextWithEvidence);
    const stack = await this.instructionStack.build({
      userInput: input,
      mode: effectiveRoute.mode,
      retrievedContext: trimmedContext
    });

    let primary = await this.runAgent("generator", effectiveRoute.agent, {
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

    const gate = new CriticGate();
    let criticReview: CriticReview = gate.review({
      mode: effectiveRoute.mode,
      output: primary.output
    });
    const groundingIssues = await this.evidenceGroundingIssues({
      mode: effectiveRoute.mode,
      output: primary.output,
      options,
      repoEvidencePack
    });
    if (groundingIssues.length) {
      criticReview = mergeCriticIssues(criticReview, groundingIssues);
    }
    let repairResult: RepairResult | undefined;
    let repairPasses = 0;
    if (!criticReview.pass && criticReview.severity !== "critical") {
      repairResult = await new RepairController(this.config.limits.maxRepairPasses).repairWithProvider({
        output: primary.output,
        issues: criticReview.issuesFound,
        mode: effectiveRoute.mode,
        originalInput: input,
        provider: this.providerForRole("generator"),
        config: this.config,
        system: stack.system,
        evidence: trimmedContext
      });
      repairPasses = repairResult.attempted ? repairResult.repairCount : 0;
      if (repairResult.pass) {
        primary = {
          ...primary,
          output: repairResult.repairedOutput
        };
        criticReview = gate.review({
          mode: effectiveRoute.mode,
          output: primary.output
        });
        const postRepairGroundingIssues = await this.evidenceGroundingIssues({
          mode: effectiveRoute.mode,
          output: primary.output,
          options,
          repoEvidencePack
        });
        if (postRepairGroundingIssues.length) {
          criticReview = mergeCriticIssues(criticReview, postRepairGroundingIssues);
        }
      }
    }

    const criticResult = await this.runAgent("critic", this.critic, {
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

    const modelCriticIssues = this.modelCriticIssues(criticResult.output, this.providerForRole("critic").name);
    if (modelCriticIssues.length) {
      criticReview = mergeCriticIssues(criticReview, modelCriticIssues);
    }

    if (!criticReview.pass) {
      const safeIssues = this.safeCriticMessages(criticReview.issuesFound);
      const safeFixes = this.safeCriticMessages(criticReview.requiredFixes);
      const failureOutput = [
        "## Critic Failure",
        "",
        "The output did not pass the local critic gate.",
        "",
        "## Issues",
        ...safeIssues.map((issue) => `- ${issue}`),
        "",
        "## Required Fixes",
        ...safeFixes.map((fix) => `- ${fix}`)
      ].join("\n");
      const validation = { valid: false, issues: safeIssues };
      const trace: RunTrace = {
        runId,
        createdAt,
        workspace: options.workspace,
        linkedRepoPath: options.linkedRepoPath,
        runtimeVersion: this.config.runtime.version,
        provider: this.provider.name,
        model: this.provider.model,
        providerRoles,
        criticModel: this.config.model.criticModel,
        evaluatorModel: this.config.model.evaluatorModel,
        classifierModel: this.config.model.classifierModel,
        temperature: this.config.model.generationTemperature,
        criticTemperature: this.config.model.criticTemperature,
        evalTemperature: this.config.model.evalTemperature,
        topP: this.config.model.topP,
        seed: this.config.model.seed,
        mode: effectiveRoute.mode,
        modeConfidence: detectedMode.confidence,
        boundaryMode: boundary.mode,
        selectedAgent: effectiveRoute.agent.name,
        policiesApplied: policyBundle.policiesApplied,
        criticPasses: 1,
        repairPasses,
        formatterPasses: 0,
        schemaRetries: retries,
        latencyMs: Date.now() - startedAt,
        toolCalls: [],
        errors: safeIssues,
        route: {
          agent: effectiveRoute.agent.name,
          mode: effectiveRoute.mode,
          reason: route.reason
        },
        replayable: this.provider.name === "mock",
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
        output: failureOutput,
        critic: criticResult.output,
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
        criticReview,
        repair: repairResult
          ? JSON.stringify(repairResult, null, 2)
          : JSON.stringify({ status: "not_attempted_due_to_critical" }, null, 2),
        final: failureOutput,
        trace,
        createdAt
      });

      return output;
    }

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

    let formatterResult = await this.runAgent("formatter", this.formatter, {
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
      formatterResult = await this.runAgent("formatter", this.formatter, {
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
      const failureOutput = [
        "## Schema Failure",
        "",
        "The output did not pass schema validation after repair.",
        "",
        "## Issues",
        ...validation.issues.map((issue) => `- ${issue}`)
      ].join("\n");
      const trace: RunTrace = {
        runId,
        createdAt,
        workspace: options.workspace,
        linkedRepoPath: options.linkedRepoPath,
        runtimeVersion: this.config.runtime.version,
        provider: this.provider.name,
        model: this.provider.model,
        providerRoles,
        criticModel: this.config.model.criticModel,
        evaluatorModel: this.config.model.evaluatorModel,
        classifierModel: this.config.model.classifierModel,
        temperature: this.config.model.generationTemperature,
        criticTemperature: this.config.model.criticTemperature,
        evalTemperature: this.config.model.evalTemperature,
        topP: this.config.model.topP,
        seed: this.config.model.seed,
        mode: effectiveRoute.mode,
        modeConfidence: detectedMode.confidence,
        boundaryMode: boundary.mode,
        selectedAgent: effectiveRoute.agent.name,
        policiesApplied: policyBundle.policiesApplied,
        criticPasses: 1,
        repairPasses,
        formatterPasses: 1,
        schemaRetries: retries,
        latencyMs: Date.now() - startedAt,
        toolCalls: [],
        errors: validation.issues,
        route: {
          agent: effectiveRoute.agent.name,
          mode: effectiveRoute.mode,
          reason: route.reason
        },
        replayable: this.provider.name === "mock",
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
        criticReview,
        repair: repairResult
          ? JSON.stringify(repairResult, null, 2)
          : JSON.stringify({ status: "not_applicable", reason: "schema validation failed after formatter" }, null, 2),
        formatter: formatterResult.output,
        final: failureOutput,
        trace,
        createdAt
      });
      throw new ValidationFailureError(validation.issues.join("; "));
    }

    const trace: RunTrace = {
      runId,
      createdAt,
      workspace: options.workspace,
      linkedRepoPath: options.linkedRepoPath,
      runtimeVersion: this.config.runtime.version,
      provider: this.provider.name,
      model: this.provider.model,
      providerRoles,
      criticModel: this.config.model.criticModel,
      evaluatorModel: this.config.model.evaluatorModel,
      classifierModel: this.config.model.classifierModel,
      temperature: this.config.model.generationTemperature,
      criticTemperature: this.config.model.criticTemperature,
      evalTemperature: this.config.model.evalTemperature,
      topP: this.config.model.topP,
      seed: this.config.model.seed,
      mode: effectiveRoute.mode,
      modeConfidence: detectedMode.confidence,
      boundaryMode: boundary.mode,
      selectedAgent: effectiveRoute.agent.name,
      policiesApplied: policyBundle.policiesApplied,
      criticPasses: 1,
      repairPasses,
      formatterPasses: 1,
      schemaRetries: retries,
      latencyMs: Date.now() - startedAt,
      toolCalls: [],
      errors: criticReview.pass ? [] : criticReview.issuesFound,
      route: {
        agent: effectiveRoute.agent.name,
        mode: effectiveRoute.mode,
        reason: route.reason
      },
      replayable: this.provider.name === "mock",
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
      criticReview,
      repair: repairResult
        ? JSON.stringify(repairResult, null, 2)
        : JSON.stringify({ status: "not_applicable", reason: "critic passed" }, null, 2),
      formatter: formatterResult.output,
      final: formatterResult.output,
      trace,
      createdAt
    });

    return output;
  }

  private async runAgent(
    role: "generator" | "critic" | "formatter",
    agent: Agent,
    input: Parameters<Agent["execute"]>[0],
    sequence: string[],
    modelCalls: ModelCallTrace[]
  ) {
    sequence.push(agent.name);
    const provider = this.providerForRole(role);
    const before = Date.now();
    const result = await agent.execute({ ...input, provider });
    modelCalls.push({
      role,
      provider: provider.name,
      model: provider.model,
      tokens:
        typeof result.metadata?.providerTokens === "number"
          ? result.metadata.providerTokens
          : undefined,
      latencyMs: Date.now() - before
    });
    return result;
  }

  private providerForRole(role: "generator" | "critic" | "formatter" | "evaluator"): ModelProvider {
    return this.roleProviders[role] ?? this.provider;
  }

  private safeCriticMessages(messages: string[]): string[] {
    return Array.from(new Set(messages.map((message) => this.safeCriticMessage(message))));
  }

  private safeCriticMessage(message: string): string {
    const lower = message.toLowerCase();
    const hasUnsupportedClaim = lower.includes("unsupported claim:");
    const hasStaxForbiddenPhrase = lower.includes("stax_fitness_forbidden_phrase");

    if (lower.startsWith("fix:") && hasUnsupportedClaim) {
      return "Remove unsupported claim.";
    }

    if (lower.startsWith("fix:") && hasStaxForbiddenPhrase) {
      return "Remove forbidden STAX phrasing.";
    }

    if (hasUnsupportedClaim) {
      return "Unsupported claim detected.";
    }

    if (hasStaxForbiddenPhrase) {
      return "STAX fitness forbidden phrasing detected.";
    }

    return message;
  }

  private async collectRepoEvidencePack(
    mode: RaxMode,
    options: RaxRunOptions
  ): Promise<RepoEvidencePack | undefined> {
    if (!options.linkedRepoPath || !isRepoFacingMode(mode)) return undefined;
    try {
      return await new RepoEvidencePackBuilder().build({
        repoPath: options.linkedRepoPath,
        workspace: options.workspace,
        workspaceResolution: options.workspace ? "named_workspace" : "current_repo"
      });
    } catch {
      return undefined;
    }
  }

  private async evidenceGroundingIssues(input: {
    mode: RaxMode;
    output: string;
    options: RaxRunOptions;
    repoEvidencePack?: RepoEvidencePack;
  }): Promise<string[]> {
    if (!input.repoEvidencePack || isMockLikeProvider(this.providerForRole("generator").name) || !isRepoFacingMode(input.mode)) {
      return [];
    }
    const commandEvidence = await new CommandEvidenceStore(this.rootDir).list({
      workspace: input.options.workspace
    });
    const grounding = new EvidenceGroundingGate().evaluate({
      mode: input.mode,
      output: input.output,
      repoEvidence: input.repoEvidencePack,
      commandEvidence
    });
    return grounding.unsupportedClaims.map((claim) => `Evidence grounding unsupported ${claim.kind}: ${claim.text}`);
  }

  private modelCriticIssues(output: string, providerName: string): string[] {
    if (isMockLikeProvider(providerName)) return [];
    const structured = parseModelCriticReview(output);
    if (structured) return modelCriticIssuesFromReview(structured);
    const lower = output.toLowerCase();
    const failed = /pass\/fail:\s*fail\b|^fail\b|\bverdict:\s*fail\b|\bnot pass\b/m.test(lower);
    if (!failed) return [];
    const issues = output
      .split(/\r?\n/)
      .filter((line) => /\b(issue|unsupported|fake|missing|required fix|invented|weak)\b/i.test(line))
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 8);
    return issues.length ? issues.map((issue) => `Model critic failure: ${issue}`) : ["Model critic failure: output did not pass adversarial critic."];
  }
}

function mergeCriticIssues(review: CriticReview, issues: string[]): CriticReview {
  const merged = Array.from(new Set([...review.issuesFound, ...issues]));
  return {
    ...review,
    pass: false,
    severity: review.severity === "critical" ? "critical" : "major",
    issuesFound: merged,
    requiredFixes: Array.from(new Set([...review.requiredFixes, ...issues.map((issue) => `Fix: ${issue}`)])),
    policyViolations: Array.from(new Set([...review.policyViolations, ...issues])),
    confidence: "high"
  };
}

function isRepoFacingMode(mode: RaxMode): boolean {
  return [
    "planning",
    "code_review",
    "codex_audit",
    "project_brain",
    "test_gap_audit",
    "policy_drift",
    "model_comparison",
    "strategic_deliberation"
  ].includes(mode);
}

function isMockLikeProvider(name: string): boolean {
  return name === "mock" || name.startsWith("mock-");
}

export async function createDefaultRuntime(
  options: RaxRuntimeOptions = {}
): Promise<RaxRuntime> {
  const rootDir = options.rootDir ?? process.cwd();
  const loaded = await loadConfig(rootDir, options.config);
  const config = mergeConfig(DEFAULT_CONFIG, loaded);
  const providerRouter = new ProviderRouter(config);
  const defaultRoleProviders = options.provider
    ? {
        generator: options.provider,
        critic: options.provider,
        formatter: options.provider,
        evaluator: options.provider
      }
    : {
        generator: providerRouter.generator(),
        critic: providerRouter.critic(),
        formatter: providerRouter.formatter(),
        evaluator: providerRouter.evaluator()
      };
  const roleProviders = {
    ...defaultRoleProviders,
    ...options.roleProviders
  };
  const generatorProvider = roleProviders.generator;
  const agents = createAgentSet();
  const router = new AgentRouter({
    intake: agents.intake,
    analyst: agents.analyst,
    planner: agents.planner
  });

  return new RaxRuntime(
    rootDir,
    config,
    generatorProvider,
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
    new ResponsePipeline(),
    undefined,
    undefined,
    undefined,
    roleProviders
  );
}
