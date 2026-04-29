import path from "node:path";
import { CommandEvidenceStore } from "../evidence/CommandEvidenceStore.js";
import { collectLocalEvidence } from "../evidence/LocalEvidenceCollector.js";
import { loadConfig } from "../core/ConfigLoader.js";
import type { RaxConfig } from "../schemas/Config.js";
import { RepoSummary } from "../workspace/RepoSummary.js";
import { WorkspaceContext } from "../workspace/WorkspaceContext.js";
import {
  SystemDoctorReportSchema,
  type SystemDoctorReport
} from "./SystemDoctorSchemas.js";

export class SystemDoctor {
  constructor(private rootDir = process.cwd()) {}

  async inspect(input: {
    workspace?: string;
    config?: RaxConfig;
    env?: NodeJS.ProcessEnv;
  } = {}): Promise<SystemDoctorReport> {
    const env = input.env ?? process.env;
    const config = input.config ?? await loadConfig(this.rootDir);
    const local = await collectLocalEvidence(this.rootDir, {
      includeLatestEval: true,
      includeLatestRun: true
    });
    const commandEvidence = await new CommandEvidenceStore(this.rootDir).list();
    const repoEvidence = await this.repoEvidenceStatus(input.workspace);
    const providers = providerStatuses(config);
    const warnings = [
      ...providers.map((provider) => provider.warning).filter((item): item is string => Boolean(item)),
      openaiKeyMissingWarning(config, env),
      config.tools.shell === "allowed" ? "WARNING: shell tool is configured as allowed." : undefined,
      config.tools.fileWrite === "allowed" ? "WARNING: fileWrite tool is configured as allowed." : undefined,
      config.memory.autoSaveModelOutputs ? "WARNING: raw model outputs are configured to auto-save." : undefined
    ].filter((item): item is string => Boolean(item));

    return SystemDoctorReportSchema.parse({
      rootDir: path.resolve(this.rootDir),
      providers,
      openaiKeyConfigured: Boolean(config.model.openaiApiKey || env.OPENAI_API_KEY),
      ollamaConfigured: Boolean(config.model.ollamaBaseUrl && config.model.ollamaModel),
      tools: {
        fileRead: config.tools.fileRead,
        fileWrite: config.tools.fileWrite,
        shell: config.tools.shell,
        web: config.tools.web,
        git: config.tools.git
      },
      memory: {
        autoSaveModelOutputs: config.memory.autoSaveModelOutputs,
        requireUserApprovedMemory: config.memory.requireUserApprovedMemory,
        approvedMemorySearchOnly: true
      },
      eval: local.latestEval
        ? {
            status: "present",
            path: local.latestEval.path,
            total: local.latestEval.total,
            passed: local.latestEval.passed,
            failed: local.latestEval.failed,
            criticalFailures: local.latestEval.criticalFailures
          }
        : { status: "missing" },
      latestRun: local.latestRunFolder
        ? { status: "present", path: local.latestRunFolder }
        : { status: "missing" },
      commandEvidence: {
        total: commandEvidence.length,
        localStax: commandEvidence.filter((item) => item.source === "local_stax_command_output").length,
        humanPasted: commandEvidence.filter((item) => item.source === "human_pasted_command_output").length,
        codexReported: commandEvidence.filter((item) => item.source === "codex_reported_command_output").length
      },
      repoEvidence,
      gitStatus: local.gitStatus,
      warnings
    });
  }

  format(report: SystemDoctorReport): string {
    return [
      "## STAX Doctor",
      "",
      "## Providers",
      ...report.providers.map((provider) => `- ${provider.role}: ${provider.provider} (${provider.model})${provider.warning ? ` -- ${provider.warning}` : ""}`),
      `- OpenAI key configured: ${report.openaiKeyConfigured ? "yes" : "no"}`,
      `- Ollama configured: ${report.ollamaConfigured ? "yes" : "no"}`,
      "",
      "## Tools",
      `- fileRead: ${report.tools.fileRead}`,
      `- fileWrite: ${report.tools.fileWrite}`,
      `- shell: ${report.tools.shell}`,
      `- web: ${report.tools.web}`,
      `- git: ${report.tools.git}`,
      "",
      "## Memory",
      `- autoSaveModelOutputs: ${report.memory.autoSaveModelOutputs}`,
      `- requireUserApprovedMemory: ${report.memory.requireUserApprovedMemory}`,
      `- approvedMemorySearchOnly: ${report.memory.approvedMemorySearchOnly}`,
      "",
      "## Latest Eval",
      report.eval.status === "present"
        ? `- ${report.eval.path}: ${report.eval.passed ?? "unknown"}/${report.eval.total ?? "unknown"} passed, failed=${report.eval.failed ?? "unknown"}, criticalFailures=${report.eval.criticalFailures ?? "unknown"}`
        : "- missing",
      "",
      "## Latest Run",
      report.latestRun.status === "present" ? `- ${report.latestRun.path}` : "- missing",
      "",
      "## Command Evidence",
      `- total: ${report.commandEvidence.total}`,
      `- local_stax_command_output: ${report.commandEvidence.localStax}`,
      `- human_pasted_command_output: ${report.commandEvidence.humanPasted}`,
      `- codex_reported_command_output: ${report.commandEvidence.codexReported}`,
      "",
      "## Repo Evidence",
      `- status: ${report.repoEvidence.status}`,
      ...(report.repoEvidence.workspace ? [`- workspace: ${report.repoEvidence.workspace}`] : []),
      ...(report.repoEvidence.linkedRepoPath ? [`- linkedRepoPath: ${report.repoEvidence.linkedRepoPath}`] : []),
      ...(report.repoEvidence.safeFilesRead !== undefined ? [`- safeFilesRead: ${report.repoEvidence.safeFilesRead}`] : []),
      ...(report.repoEvidence.error ? [`- error: ${report.repoEvidence.error}`] : []),
      "",
      "## Git",
      "```txt",
      report.gitStatus,
      "```",
      "",
      "## Warnings",
      ...(report.warnings.length ? report.warnings.map((warning) => `- ${warning}`) : ["- none"])
    ].join("\n");
  }

  private async repoEvidenceStatus(workspace?: string): Promise<SystemDoctorReport["repoEvidence"]> {
    let context;
    try {
      context = await new WorkspaceContext(this.rootDir).resolve({ workspace });
    } catch (error) {
      return {
        status: "failed",
        workspace,
        error: error instanceof Error ? error.message : String(error)
      };
    }
    if (!context.linkedRepoPath) {
      return { status: "not_configured", workspace: context.workspace ?? workspace };
    }
    try {
      const summary = await new RepoSummary(context.linkedRepoPath).summarize();
      return {
        status: "available",
        workspace: context.workspace,
        linkedRepoPath: context.linkedRepoPath,
        safeFilesRead: summary.safeFilesRead.length
      };
    } catch (error) {
      return {
        status: "failed",
        workspace: context.workspace,
        linkedRepoPath: context.linkedRepoPath,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

function providerStatuses(config: RaxConfig): SystemDoctorReport["providers"] {
  return [
    {
      role: "generator",
      provider: config.model.generatorProvider,
      model: modelFor(config, config.model.generatorProvider, config.model.generationModel),
      warning: config.model.generatorProvider === "mock" ? "WARNING: generator provider is mock; intelligence claims are dry-run only." : undefined
    },
    {
      role: "critic",
      provider: config.model.criticProvider,
      model: modelFor(config, config.model.criticProvider, config.model.criticModel),
      warning: config.model.criticProvider === "mock" ? "WARNING: critic provider is mock; model critique is not real." : undefined
    },
    {
      role: "evaluator",
      provider: config.model.evaluatorProvider,
      model: modelFor(config, config.model.evaluatorProvider, config.model.evaluatorModel),
      warning: config.model.evaluatorProvider === "mock" ? "WARNING: evaluator provider is mock; model evaluation is deterministic/dry-run." : undefined
    },
    {
      role: "classifier",
      provider: config.model.classifierProvider,
      model: config.model.classifierProvider === "rules" ? "rules" : modelFor(config, config.model.classifierProvider, config.model.classifierModel)
    }
  ];
}

function modelFor(config: RaxConfig, provider: string, configuredModel: string): string {
  if (provider === "openai") return config.model.openaiModel || configuredModel;
  if (provider === "ollama") return config.model.ollamaModel || configuredModel;
  return configuredModel;
}

function openaiKeyMissingWarning(config: RaxConfig, env: NodeJS.ProcessEnv): string | undefined {
  const usesOpenAI = [
    config.model.provider,
    config.model.generatorProvider,
    config.model.criticProvider,
    config.model.evaluatorProvider,
    config.model.classifierProvider
  ].includes("openai");
  const hasKey = Boolean(config.model.openaiApiKey || env.OPENAI_API_KEY);
  return usesOpenAI && !hasKey ? "WARNING: OpenAI provider configured but OPENAI_API_KEY is missing." : undefined;
}
