import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { DEFAULT_CONFIG, type DeepPartial, type RaxConfig } from "../schemas/Config.js";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T extends Record<string, unknown>>(base: T, override?: DeepPartial<T>): T {
  if (!override) {
    return structuredClone(base);
  }

  const result = structuredClone(base) as Record<string, unknown>;
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) {
      continue;
    }
    if (isObject(result[key]) && isObject(value)) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, value);
      continue;
    }
    result[key] = value;
  }
  return result as T;
}

async function readJsonConfig(rootDir: string): Promise<DeepPartial<RaxConfig> | undefined> {
  const configPath = path.join(rootDir, "rax.config.json");
  try {
    const raw = await fs.readFile(configPath, "utf8");
    return JSON.parse(raw) as DeepPartial<RaxConfig>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export async function loadConfig(
  rootDir = process.cwd(),
  override?: DeepPartial<RaxConfig>
): Promise<RaxConfig> {
  dotenv.config({ path: path.join(rootDir, ".env"), quiet: true });

  const fileConfig = await readJsonConfig(rootDir);
  const withFile = mergeConfig(DEFAULT_CONFIG, fileConfig);
  const withOverride = mergeConfig(withFile, override);
  const envProvider = process.env.RAX_PROVIDER as RaxConfig["model"]["provider"] | undefined;
  const envGeneratorProvider = process.env.RAX_GENERATOR_PROVIDER as RaxConfig["model"]["generatorProvider"] | undefined;
  const envCriticProvider = process.env.RAX_CRITIC_PROVIDER as RaxConfig["model"]["criticProvider"] | undefined;
  const envEvaluatorProvider = process.env.RAX_EVALUATOR_PROVIDER as RaxConfig["model"]["evaluatorProvider"] | undefined;
  const envClassifierProvider = process.env.RAX_CLASSIFIER_PROVIDER as RaxConfig["model"]["classifierProvider"] | undefined;
  const envLogRuns = process.env.RAX_LOG_RUNS;

  return mergeConfig(withOverride, {
    model: {
      provider: envProvider ?? withOverride.model.provider,
      generatorProvider: envGeneratorProvider ?? withOverride.model.generatorProvider,
      criticProvider: envCriticProvider ?? withOverride.model.criticProvider,
      evaluatorProvider: envEvaluatorProvider ?? withOverride.model.evaluatorProvider,
      classifierProvider: envClassifierProvider ?? withOverride.model.classifierProvider,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? withOverride.model.ollamaBaseUrl,
      ollamaModel: process.env.OLLAMA_MODEL ?? withOverride.model.ollamaModel,
      openaiApiKey: process.env.OPENAI_API_KEY ?? withOverride.model.openaiApiKey,
      openaiModel: process.env.OPENAI_MODEL ?? withOverride.model.openaiModel
    },
    runtime: {
      logRuns:
        envLogRuns === undefined
          ? withOverride.runtime.logRuns
          : envLogRuns.toLowerCase() !== "false"
    }
  });
}

export function mergeConfig(
  base: RaxConfig,
  override?: DeepPartial<RaxConfig>
): RaxConfig {
  return deepMerge(base as unknown as Record<string, unknown>, override as DeepPartial<Record<string, unknown>>) as unknown as RaxConfig;
}
