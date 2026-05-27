import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type AttachedRepoImpactCommand = {
  label: string;
  command: string;
  args: string[];
  allowNonZero?: boolean;
};

export type AttachedRepoImpactPlanEntry = {
  repo: string;
  repoName: string;
  outFile: string;
  commands: AttachedRepoImpactCommand[];
};

export type AttachedRepoImpactPlan = {
  schemaVersion: "stax-attached-repo-impact-export-plan-v1";
  generatedAt: string;
  dryRun: boolean;
  requiresCurrentRepoConfirmation: boolean;
  entries: AttachedRepoImpactPlanEntry[];
};

export type AttachedRepoImpactRunResult = {
  label: string;
  command: string;
  args: string[];
  exitCode: number;
  stdoutPreview: string;
  stderrPreview: string;
};

export type AttachedRepoImpactRunSummary = {
  schemaVersion: "stax-attached-repo-impact-export-summary-v1";
  generatedAt: string;
  dryRun: boolean;
  outDir: string;
  results: Array<{
    repo: string;
    repoName: string;
    outFile: string;
    commands: AttachedRepoImpactRunResult[];
  }>;
};

type ParsedArgs = {
  repos: string[];
  outDir: string;
  dryRun: boolean;
  confirmCurrentRepos: boolean;
  continueOnError: boolean;
};

function argValues(argv: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === name && argv[index + 1]) {
      values.push(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith(`${name}=`)) {
      values.push(arg.slice(`${name}=`.length));
    }
  }
  return values;
}

function argValue(argv: string[], name: string): string | undefined {
  return argValues(argv, name)[0];
}

export function parseAttachedRepoImpactArgs(argv: string[]): ParsedArgs {
  return {
    repos: argValues(argv, "--repo"),
    outDir: path.resolve(process.cwd(), argValue(argv, "--out-dir") ?? path.join("reports", "pattern_promotion", "attached_repo_exports")),
    dryRun: argv.includes("--dry-run"),
    confirmCurrentRepos: argv.includes("--confirm-current-repos"),
    continueOnError: argv.includes("--continue-on-error")
  };
}

export function buildAttachedRepoImpactPlan(input: {
  repos: string[];
  outDir: string;
  dryRun?: boolean;
  generatedAt?: string;
}): AttachedRepoImpactPlan {
  if (input.repos.length === 0) {
    throw new Error("Usage: npm run stax:attached-impact-export -- --repo <path> [--repo <path> ...] --out-dir <dir> --confirm-current-repos");
  }

  return {
    schemaVersion: "stax-attached-repo-impact-export-plan-v1",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: input.dryRun ?? false,
    requiresCurrentRepoConfirmation: true,
    entries: input.repos.map((repo) => {
      const repoPath = path.resolve(repo);
      const repoName = safeRepoName(repoPath);
      const outFile = path.join(input.outDir, `${repoName}-impact.json`);
      return {
        repo: repoPath,
        repoName,
        outFile,
        commands: [
          {
            label: "sidecar-upgrade-discover-surfaces",
            command: npmExecutable(),
            args: ["run", "stax:sidecar-upgrade", "--", "--repo", repoPath, "--discover-surfaces"]
          },
          {
            label: "sidecar-gate",
            command: npmExecutable(),
            args: ["run", "stax:gate", "--", "--repo", repoPath],
            allowNonZero: true
          },
          {
            label: "sidecar-next-prompt",
            command: npmExecutable(),
            args: ["run", "stax:next-prompt", "--", "--repo", repoPath],
            allowNonZero: true
          },
          {
            label: "export-impact-evidence",
            command: npmExecutable(),
            args: ["run", "stax:export-impact-evidence", "--", "--repo", repoPath, "--out", outFile]
          }
        ]
      };
    })
  };
}

export async function runAttachedRepoImpactExport(input: {
  plan: AttachedRepoImpactPlan;
  outDir: string;
  continueOnError?: boolean;
}): Promise<AttachedRepoImpactRunSummary> {
  await fs.mkdir(input.outDir, { recursive: true });
  const results: AttachedRepoImpactRunSummary["results"] = [];

  for (const entry of input.plan.entries) {
    const commands: AttachedRepoImpactRunResult[] = [];
    for (const command of entry.commands) {
      const result = await runCommand(command);
      commands.push(result);
      if (result.exitCode !== 0 && !command.allowNonZero && !input.continueOnError) {
        results.push({ repo: entry.repo, repoName: entry.repoName, outFile: entry.outFile, commands });
        return writeSummary({ outDir: input.outDir, dryRun: false, results });
      }
    }
    results.push({ repo: entry.repo, repoName: entry.repoName, outFile: entry.outFile, commands });
  }

  return writeSummary({ outDir: input.outDir, dryRun: false, results });
}

async function runCommand(command: AttachedRepoImpactCommand): Promise<AttachedRepoImpactRunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(command.command, command.args, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 16,
      timeout: 1000 * 60 * 20
    });
    return {
      label: command.label,
      command: command.command,
      args: command.args,
      exitCode: 0,
      stdoutPreview: tail(stdout),
      stderrPreview: tail(stderr)
    };
  } catch (error) {
    const cause = error as { stdout?: string; stderr?: string; code?: number | string };
    return {
      label: command.label,
      command: command.command,
      args: command.args,
      exitCode: typeof cause.code === "number" ? cause.code : 1,
      stdoutPreview: tail(cause.stdout ?? ""),
      stderrPreview: tail(cause.stderr ?? "")
    };
  }
}

async function writeSummary(input: {
  outDir: string;
  dryRun: boolean;
  results: AttachedRepoImpactRunSummary["results"];
}): Promise<AttachedRepoImpactRunSummary> {
  const summary: AttachedRepoImpactRunSummary = {
    schemaVersion: "stax-attached-repo-impact-export-summary-v1",
    generatedAt: new Date().toISOString(),
    dryRun: input.dryRun,
    outDir: input.outDir,
    results: input.results
  };
  await fs.mkdir(input.outDir, { recursive: true });
  await fs.writeFile(path.join(input.outDir, "attached-repo-impact-export-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return summary;
}

function safeRepoName(repoPath: string): string {
  return path.basename(repoPath).replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "") || "repo";
}

function npmExecutable(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function tail(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 4000 ? trimmed.slice(-4000) : trimmed;
}

async function main(): Promise<void> {
  const args = parseAttachedRepoImpactArgs(process.argv.slice(2));
  const plan = buildAttachedRepoImpactPlan({
    repos: args.repos,
    outDir: args.outDir,
    dryRun: args.dryRun
  });

  if (args.dryRun) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }

  if (!args.confirmCurrentRepos) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    throw new Error("Refusing to touch attached repos without --confirm-current-repos. Use --dry-run to print the plan only.");
  }

  const summary = await runAttachedRepoImpactExport({
    plan,
    outDir: args.outDir,
    continueOnError: args.continueOnError
  });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  const hardFailure = summary.results.some((result) =>
    result.commands.some((command) => {
      const planned = plan.entries.find((entry) => entry.repo === result.repo)?.commands.find((item) => item.label === command.label);
      return command.exitCode !== 0 && !planned?.allowNonZero;
    })
  );
  if (hardFailure) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
