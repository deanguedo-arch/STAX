import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type StructuredCommand = {
  executable: "npm" | "git";
  args: string[];
  cwd: string;
  timeoutMs?: number;
  maxBufferBytes?: number;
};

export type StructuredCommandResult = {
  command: StructuredCommand;
  stdout: string;
  stderr: string;
};

const FORBIDDEN_ARG_CHARS = /[;&|`$<>\n\r]/;

const SAFE_NPM_SCRIPTS = new Set([
  "typecheck",
  "test",
  "build",
  "audit:doctrine",
  "audit:boundaries",
  "audit:security",
  "rax",
  "test:unit",
  "test:ci-safe",
  "validate:hardened"
]);

const SAFE_GIT_SUBCOMMANDS = new Set([
  "status",
  "diff",
  "rev-parse"
]);

export function npmCommand(
  cwd: string,
  args: string[],
  options: Omit<StructuredCommand, "executable" | "args" | "cwd"> = {}
): StructuredCommand {
  return validateStructuredCommand({ executable: "npm", args, cwd, ...options });
}

export function gitCommand(
  cwd: string,
  args: string[],
  options: Omit<StructuredCommand, "executable" | "args" | "cwd"> = {}
): StructuredCommand {
  return validateStructuredCommand({ executable: "git", args, cwd, ...options });
}

export function validateStructuredCommand(
  command: StructuredCommand
): StructuredCommand {
  if (!command.cwd.trim()) {
    throw new Error("Structured command requires cwd.");
  }
  for (const arg of command.args) {
    if (!arg.trim()) {
      throw new Error("Structured command contains an empty argument.");
    }
    if (FORBIDDEN_ARG_CHARS.test(arg)) {
      throw new Error(`Structured command rejected unsafe argument: ${arg}`);
    }
  }
  if (command.executable === "npm") validateNpmArgs(command.args);
  if (command.executable === "git") validateGitArgs(command.args);
  return command;
}

export async function runStructuredCommand(
  command: StructuredCommand
): Promise<StructuredCommandResult> {
  const validated = validateStructuredCommand(command);
  const executable =
    process.platform === "win32" && validated.executable === "npm"
      ? "npm.cmd"
      : validated.executable;
  const { stdout, stderr } = await execFileAsync(executable, validated.args, {
    cwd: validated.cwd,
    timeout: validated.timeoutMs ?? 120000,
    maxBuffer: validated.maxBufferBytes ?? 1024 * 1024 * 8
  });
  return { command: validated, stdout, stderr };
}

export function renderStructuredCommand(command: StructuredCommand): string {
  return [command.executable, ...command.args].join(" ");
}

function validateNpmArgs(args: string[]): void {
  if (args[0] !== "run" && args[0] !== "test") {
    throw new Error(`Unsupported npm invocation: npm ${args.join(" ")}`);
  }
  if (args[0] === "test") return;
  const script = args[1];
  if (!script || !SAFE_NPM_SCRIPTS.has(script)) {
    throw new Error(`Unsupported npm script: ${script ?? "(missing)"}`);
  }
}

function validateGitArgs(args: string[]): void {
  const subcommand = args[0] === "-C" ? args[2] : args[0];
  if (!subcommand || !SAFE_GIT_SUBCOMMANDS.has(subcommand)) {
    throw new Error(`Unsupported git invocation: git ${args.join(" ")}`);
  }
}
