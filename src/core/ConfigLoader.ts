import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { DEFAULT_CONFIG, type RaxConfig } from "../schemas/Config.js";

function mergeConfig(base: RaxConfig, override?: Partial<RaxConfig>): RaxConfig {
  if (!override) {
    return structuredClone(base);
  }

  const baseVersions = base.versions ?? DEFAULT_CONFIG.versions!;

  return {
    ...base,
    ...override,
    provider: {
      ...base.provider,
      ...override.provider
    },
    runtime: {
      ...base.runtime,
      ...override.runtime
    },
    limits: {
      ...base.limits,
      ...override.limits
    },
    versions: {
      ...baseVersions,
      ...override.versions
    },
    memory: {
      ...base.memory,
      ...override.memory
    },
    tools: {
      ...base.tools,
      ...override.tools
    },
    safety: {
      ...base.safety,
      ...override.safety
    }
  };
}

async function readJsonConfig(rootDir: string): Promise<Partial<RaxConfig> | undefined> {
  const configPath = path.join(rootDir, "rax.config.json");
  try {
    const raw = await fs.readFile(configPath, "utf8");
    return JSON.parse(raw) as Partial<RaxConfig>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export async function loadConfig(
  rootDir = process.cwd(),
  override?: Partial<RaxConfig>
): Promise<RaxConfig> {
  dotenv.config({ path: path.join(rootDir, ".env"), quiet: true });

  const fileConfig = await readJsonConfig(rootDir);
  const withFile = mergeConfig(DEFAULT_CONFIG, fileConfig);
  const withOverride = mergeConfig(withFile, override);

  const envProvider = process.env.RAX_PROVIDER as RaxConfig["provider"]["type"] | undefined;
  const envLogRuns = process.env.RAX_LOG_RUNS;

  return mergeConfig(withOverride, {
    provider: {
      type: envProvider ?? withOverride.provider.type,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? withOverride.provider.ollamaBaseUrl,
      ollamaModel: process.env.OLLAMA_MODEL ?? withOverride.provider.ollamaModel,
      openaiApiKey: process.env.OPENAI_API_KEY ?? withOverride.provider.openaiApiKey,
      openaiModel: process.env.OPENAI_MODEL ?? withOverride.provider.openaiModel
    },
    runtime: {
      logRuns:
        envLogRuns === undefined
          ? withOverride.runtime.logRuns
          : envLogRuns.toLowerCase() !== "false"
    }
  });
}

export { mergeConfig };
