import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type StaxCoreCommandCheckName =
  | "typecheck"
  | "tests"
  | "evalFixtureAudit"
  | "eval"
  | "regressionEval"
  | "redteamEval"
  | "doctrineAudit"
  | "boundaryAudit"
  | "securityAudit";

export type StaxCoreCommandCheck = {
  name: StaxCoreCommandCheckName;
  command: string;
  passed: boolean;
  exitCode: number;
  durationMs: number;
  stdoutPreview: string;
  stderrPreview: string;
};

export type ResolveNestedCommandOptions = {
  platform?: NodeJS.Platform;
  nodePath?: string;
  npmExecPath?: string;
};

export type ResolvedNestedCommand = {
  command: string;
  args: string[];
};

export function resolveNestedCommand(
  command: string[],
  options: ResolveNestedCommandOptions = {}
): ResolvedNestedCommand {
  const executable = command[0]!;
  const args = command.slice(1);
  if (executable !== "npm") {
    return { command: executable, args };
  }

  if (options.npmExecPath) {
    return {
      command: options.nodePath ?? process.execPath,
      args: [options.npmExecPath, ...args]
    };
  }

  if ((options.platform ?? process.platform) === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "npm", ...args]
    };
  }

  return {
    command: "npm",
    args
  };
}

export function previewOutput(text: string, max = 2400): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n...[truncated]`;
}

export async function runStaxCoreCheck(
  name: StaxCoreCommandCheckName,
  command: string[],
  cwd: string
): Promise<StaxCoreCommandCheck> {
  const started = Date.now();
  let passed = false;
  let exitCode = 0;
  let stdout = "";
  let stderr = "";
  const resolved = resolveNestedCommand(command, {
    nodePath: process.execPath,
    npmExecPath: process.env.npm_execpath
  });

  try {
    const result = await execFileAsync(resolved.command, resolved.args, {
      cwd,
      env: sanitizedNestedCommandEnv(process.env),
      maxBuffer: 16 * 1024 * 1024
    });
    stdout = result.stdout;
    stderr = result.stderr;
    passed = true;
  } catch (error) {
    const cause = error as {
      code?: number | string;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    stdout = cause.stdout ?? "";
    stderr = cause.stderr ?? cause.message ?? "";
    exitCode = typeof cause.code === "number" ? cause.code : 1;
    passed = false;
  }

  return {
    name,
    command: command.join(" "),
    passed,
    exitCode,
    durationMs: Date.now() - started,
    stdoutPreview: previewOutput(stdout),
    stderrPreview: previewOutput(stderr)
  };
}

function sanitizedNestedCommandEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = { ...env };
  for (const key of Object.keys(next)) {
    if (
      key === "INIT_CWD" ||
      key === "npm_command" ||
      key === "npm_execpath" ||
      key === "npm_node_execpath" ||
      key === "npm_package_json" ||
      key === "npm_lifecycle_event" ||
      key === "npm_lifecycle_script" ||
      key.startsWith("npm_config_") ||
      key.startsWith("npm_package_")
    ) {
      delete next[key];
    }
  }
  return next;
}
