import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { SystemDoctor } from "../src/doctor/SystemDoctor.js";
import { CommandEvidenceStore } from "../src/evidence/CommandEvidenceStore.js";
import { mergeConfig } from "../src/core/ConfigLoader.js";
import { DEFAULT_CONFIG, type RaxConfig } from "../src/schemas/Config.js";

const execFileAsync = promisify(execFile);

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-doctor-"));
}

function cliInvocation(args: string[]): { command: string; commandArgs: string[] } {
  const repoRoot = process.cwd();
  const tsxBin = path.join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  const cliPath = path.join(repoRoot, "src", "cli.ts");
  return {
    command: process.platform === "win32" ? "cmd.exe" : tsxBin,
    commandArgs: process.platform === "win32" ? ["/c", tsxBin, cliPath, ...args] : [cliPath, ...args]
  };
}

describe("SystemDoctor", () => {
  it("warns loudly when model roles use mock providers", async () => {
    const rootDir = await tempRoot();

    const report = await new SystemDoctor(rootDir).inspect({ env: {} });

    expect(report.providers.find((provider) => provider.role === "generator")?.warning).toContain("generator provider is mock");
    expect(report.providers.find((provider) => provider.role === "critic")?.warning).toContain("critic provider is mock");
    expect(report.providers.find((provider) => provider.role === "evaluator")?.warning).toContain("evaluator provider is mock");
    expect(report.warnings.join("\n")).toContain("generator provider is mock");
  });

  it("warns when OpenAI is configured without an API key", async () => {
    const rootDir = await tempRoot();
    const config = mergeConfig(DEFAULT_CONFIG, {
      model: {
        provider: "openai",
        generatorProvider: "openai",
        criticProvider: "mock",
        evaluatorProvider: "mock",
        openaiApiKey: undefined
      }
    }) as RaxConfig;

    const report = await new SystemDoctor(rootDir).inspect({ config, env: {} });

    expect(report.openaiKeyConfigured).toBe(false);
    expect(report.warnings.join("\n")).toContain("OPENAI_API_KEY is missing");
  });

  it("does not print secret values", async () => {
    const rootDir = await tempRoot();
    const secret = "sk-test-secret-value-that-must-not-print";
    const config = mergeConfig(DEFAULT_CONFIG, {
      model: {
        provider: "openai",
        generatorProvider: "openai",
        openaiApiKey: secret
      }
    }) as RaxConfig;

    const report = await new SystemDoctor(rootDir).inspect({ config, env: { OPENAI_API_KEY: secret } });
    const formatted = new SystemDoctor(rootDir).format(report);
    const json = JSON.stringify(report);

    expect(formatted).not.toContain(secret);
    expect(json).not.toContain(secret);
    expect(formatted).toContain("OpenAI key configured: yes");
  });

  it("shows shell and fileWrite settings plus command evidence counts", async () => {
    const rootDir = await tempRoot();
    await new CommandEvidenceStore(rootDir).record({
      command: "npm test",
      exitCode: 0,
      stdout: "passed",
      summary: "tests passed"
    });
    await new CommandEvidenceStore(rootDir).record({
      command: "npm run build",
      exitCode: 0,
      source: "human_pasted_command_output",
      stdout: "passed",
      summary: "human pasted build output"
    });

    const report = await new SystemDoctor(rootDir).inspect({ env: {} });

    expect(report.tools.shell).toBe("disabled");
    expect(report.tools.fileWrite).toBe("disabled");
    expect(report.memory.autoSaveModelOutputs).toBe(false);
    expect(report.memory.requireUserApprovedMemory).toBe(true);
    expect(report.commandEvidence.total).toBe(2);
    expect(report.commandEvidence.localStax).toBe(1);
    expect(report.commandEvidence.humanPasted).toBe(1);
  });

  it("reports latest eval and latest run when present", async () => {
    const rootDir = await tempRoot();
    await fs.mkdir(path.join(rootDir, "evals", "eval_results"), { recursive: true });
    await fs.writeFile(
      path.join(rootDir, "evals", "eval_results", "latest.json"),
      JSON.stringify({ total: 3, passed: 3, failed: 0, passRate: 1, criticalFailures: 0 }),
      "utf8"
    );
    await fs.mkdir(path.join(rootDir, "runs", "2026-04-29", "run-abc"), { recursive: true });

    const report = await new SystemDoctor(rootDir).inspect({ env: {} });

    expect(report.eval.status).toBe("present");
    expect(report.eval.passed).toBe(3);
    expect(report.latestRun.status).toBe("present");
    expect(report.latestRun.path).toContain("run-abc");
  });

  it("exposes doctor through the CLI without executing tools", async () => {
    const rootDir = await tempRoot();
    const cli = cliInvocation(["doctor", "--print", "json"]);

    const { stdout } = await execFileAsync(cli.command, cli.commandArgs, { cwd: rootDir });
    const report = JSON.parse(stdout) as { providers: Array<{ role: string; provider: string }>; tools: { shell: string; fileWrite: string } };

    expect(report.providers.find((provider) => provider.role === "generator")?.provider).toBe("mock");
    expect(report.tools.shell).toBe("disabled");
    expect(report.tools.fileWrite).toBe("disabled");
  }, 30000);
});
