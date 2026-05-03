import fs from "node:fs/promises";
import path from "node:path";
import {
  initializeLiveCodexLoopTask,
  recordLiveCodexLoopTurn
} from "../src/campaign/LiveCodexLoopRunner.js";
import type { StructuredProjectControlEvidencePacket } from "../src/projectControl/ProjectControlEvidencePacket.js";

type CliArgs =
  | {
      mode: "init";
      ledger: string;
      taskId: string;
      repo: string;
      objective: string;
      packetPath: string;
    }
  | {
      mode: "record";
      ledger: string;
      taskId: string;
      codexReportPath: string;
      diffPath: string;
      commandPath: string;
      packetPath?: string;
    };

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "init") {
    const packet = JSON.parse(await fs.readFile(args.packetPath, "utf8")) as StructuredProjectControlEvidencePacket;
    const result = await initializeLiveCodexLoopTask({
      ledgerPath: args.ledger,
      taskId: args.taskId,
      repo: args.repo,
      objective: args.objective,
      packet
    });
    process.stdout.write(`${JSON.stringify({ ledgerPath: path.relative(process.cwd(), args.ledger), task: result.task }, null, 2)}\n`);
    return;
  }

  const codexReport = await fs.readFile(args.codexReportPath, "utf8");
  const diffEvidence = await fs.readFile(args.diffPath, "utf8");
  const commandEvidence = await fs.readFile(args.commandPath, "utf8");
  const packet = args.packetPath
    ? (JSON.parse(await fs.readFile(args.packetPath, "utf8")) as StructuredProjectControlEvidencePacket)
    : undefined;
  const result = await recordLiveCodexLoopTurn({
    ledgerPath: args.ledger,
    taskId: args.taskId,
    codexReport,
    diffEvidence,
    commandEvidence,
    packet
  });
  process.stdout.write(`${JSON.stringify({ ledgerPath: path.relative(process.cwd(), args.ledger), task: result.task }, null, 2)}\n`);
}

function parseArgs(argv: string[]): CliArgs {
  const mode = argv[0];
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  if (mode === "init") {
    const ledger = get("--ledger");
    const taskId = get("--task");
    const repo = get("--repo");
    const objective = get("--objective");
    const packetPath = get("--packet");
    if (!ledger || !taskId || !repo || !objective || !packetPath) {
      throw new Error("Usage: tsx scripts/liveCodexLoopRunner.ts init --ledger <path> --task <id> --repo <name> --objective <text> --packet <packet.json>");
    }
    return { mode, ledger, taskId, repo, objective, packetPath };
  }
  if (mode === "record") {
    const ledger = get("--ledger");
    const taskId = get("--task");
    const codexReportPath = get("--codex-report");
    const diffPath = get("--diff");
    const commandPath = get("--command");
    const packetPath = get("--packet");
    if (!ledger || !taskId || !codexReportPath || !diffPath || !commandPath) {
      throw new Error("Usage: tsx scripts/liveCodexLoopRunner.ts record --ledger <path> --task <id> --codex-report <file> --diff <file> --command <file> [--packet <packet.json>]");
    }
    return { mode, ledger, taskId, codexReportPath, diffPath, commandPath, packetPath };
  }
  throw new Error("Expected subcommand: init | record");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
