#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { createCorrection } from "./core/Corrections.js";
import { runEvals } from "./core/EvalRunner.js";
import { replayRun } from "./core/Replay.js";
import { createDefaultRuntime } from "./core/RaxRuntime.js";
import { MemoryStore } from "./memory/MemoryStore.js";
import { logError, logInfo } from "./utils/logger.js";

type ParsedArgs = {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
};

const knownCommands = new Set([
  "run",
  "batch",
  "eval",
  "replay",
  "memory",
  "correct",
  "help"
]);

function parseArgs(argv: string[]): ParsedArgs {
  const first = argv[0];
  const command = first && knownCommands.has(first) ? first : "run";
  const remaining = command === "run" && first && !knownCommands.has(first) ? argv : argv.slice(1);
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < remaining.length; index += 1) {
    const arg = remaining[index];
    if (arg?.startsWith("--")) {
      const key = arg.slice(2);
      const next = remaining[index + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        index += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }
    if (arg) {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

async function runCommand(args: ParsedArgs): Promise<void> {
  const file = args.flags.file;
  const input =
    typeof file === "string"
      ? await fs.readFile(file, "utf8")
      : args.positional.join(" ");

  if (!input.trim()) {
    throw new Error("No input supplied.");
  }

  const runtime = await createDefaultRuntime();
  const output = await runtime.run(input);
  logInfo(output.output);
  logInfo("");
  logInfo(`Run: ${output.runId}`);
}

async function batchCommand(args: ParsedArgs): Promise<void> {
  const folder = args.positional[0];
  if (!folder) {
    throw new Error("Usage: rax batch <folder>");
  }

  const runtime = await createDefaultRuntime();
  const entries = await fs.readdir(folder);
  for (const entry of entries) {
    const fullPath = path.join(folder, entry);
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
      continue;
    }
    const input = await fs.readFile(fullPath, "utf8");
    const output = await runtime.run(input);
    logInfo(`${entry}: ${output.runId}`);
  }
}

async function evalCommand(): Promise<void> {
  const result = await runEvals();
  logInfo(JSON.stringify(result, null, 2));
  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

async function replayCommand(args: ParsedArgs): Promise<void> {
  const runId = args.positional[0];
  const date = typeof args.flags.date === "string" ? args.flags.date : undefined;
  if (!runId) {
    throw new Error("Usage: rax replay <run-id>");
  }
  const result = await replayRun({ runId, date });
  logInfo(JSON.stringify(result, null, 2));
  if (!result.exact) {
    process.exitCode = 1;
  }
}

async function memoryCommand(args: ParsedArgs): Promise<void> {
  if (args.positional[0] !== "search") {
    throw new Error('Usage: rax memory search "query"');
  }
  const query = args.positional.slice(1).join(" ");
  const store = new MemoryStore();
  const results = await store.search(query);
  logInfo(JSON.stringify(results, null, 2));
}

async function correctCommand(args: ParsedArgs): Promise<void> {
  const runId = args.positional[0];
  const date = typeof args.flags.date === "string" ? args.flags.date : undefined;
  const outputFile =
    typeof args.flags.output === "string" ? args.flags.output : undefined;
  const reason =
    typeof args.flags.reason === "string" ? args.flags.reason : "Manual correction";

  if (!runId || !outputFile) {
    throw new Error(
      "Usage: rax correct <run-id> --output corrected.md --reason \"...\""
    );
  }

  const correctedOutput = await fs.readFile(outputFile, "utf8");
  const record = await createCorrection({
    runId,
    date,
    correctedOutput,
    reason
  });
  logInfo(record.path);
}

function help(): void {
  logInfo([
    "RAX commands:",
    '  rax run "input"',
    "  rax run --file input.txt",
    "  rax batch folder/",
    "  rax eval",
    "  rax replay <run-id>",
    '  rax memory search "query"',
    '  rax correct <run-id> --output corrected.md --reason "..."'
  ].join("\n"));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "run") {
    await runCommand(args);
  } else if (args.command === "batch") {
    await batchCommand(args);
  } else if (args.command === "eval") {
    await evalCommand();
  } else if (args.command === "replay") {
    await replayCommand(args);
  } else if (args.command === "memory") {
    await memoryCommand(args);
  } else if (args.command === "correct") {
    await correctCommand(args);
  } else {
    help();
  }
}

main().catch((error: unknown) => {
  logError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
