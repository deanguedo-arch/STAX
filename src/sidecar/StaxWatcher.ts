import fs from "node:fs/promises";
import path from "node:path";
import { tryCollectCodexTurn, writeSidecarHeartbeat } from "./CodexTurnCapture.js";
import { runStaxGate, type StaxGateStatus } from "./StaxGate.js";
import { pathExists, readTextIfExists, runGit, sha256, sidecarDir, validateRepoPath } from "./SidecarRepo.js";

export type StaxWatcherOptions = {
  repoPath: string;
  intervalMs?: number;
  sessionsRoot?: string;
  sourceFile?: string;
  onVerdictChange?: (status: StaxGateStatus) => void;
};

export class StaxWatcher {
  private previousInputHash = "";
  private previousVerdict = "";

  constructor(private readonly options: StaxWatcherOptions) {}

  async scanOnce(): Promise<{ audited: boolean; status?: StaxGateStatus; verdictChanged: boolean }> {
    const repoPath = await validateRepoPath(this.options.repoPath);
    const staxPath = sidecarDir(repoPath);
    if (!(await pathExists(staxPath))) {
      throw new Error(`STAX Sidecar is not attached for ${repoPath}. Run npm run stax:attach -- --repo ${repoPath}`);
    }
    await writeSidecarHeartbeat({ repoPath });
    await tryCollectCodexTurn({
      repoPath,
      sessionsRoot: this.options.sessionsRoot,
      sourceFile: this.options.sourceFile
    });

    const inputHash = await computeWatcherInputHash(repoPath);
    if (inputHash === this.previousInputHash) {
      return { audited: false, verdictChanged: false };
    }
    this.previousInputHash = inputHash;
    const status = await runStaxGate({ repoPath });
    const verdictChanged = status.verdict !== this.previousVerdict;
    if (verdictChanged) {
      this.previousVerdict = status.verdict;
      this.options.onVerdictChange?.(status);
    }
    return { audited: true, status, verdictChanged };
  }

  async start(): Promise<() => void> {
    await this.scanOnce();
    const timer = setInterval(() => {
      this.scanOnce().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[STAX] Watch error: ${message}\n`);
      });
    }, this.options.intervalMs ?? 2500);
    return () => clearInterval(timer);
  }
}

export async function startStaxWatcher(options: StaxWatcherOptions): Promise<() => void> {
  const watcher = new StaxWatcher(options);
  return watcher.start();
}

async function computeWatcherInputHash(repoPath: string): Promise<string> {
  const staxPath = sidecarDir(repoPath);
  const commandDir = path.join(staxPath, "command-evidence");
  const commandFiles = await fs.readdir(commandDir).catch(() => []);
  const commandStats = await Promise.all(
    commandFiles.sort().map(async (name) => {
      const filePath = path.join(commandDir, name);
      const stats = await fs.stat(filePath).catch(() => undefined);
      return `${name}:${stats?.mtimeMs ?? 0}:${stats?.size ?? 0}`;
    })
  );
  const inputs = await Promise.all([
    readTextIfExists(path.join(staxPath, "task.md")),
    readTextIfExists(path.join(staxPath, "codex-report.md")),
    runGit(repoPath, ["status", "--short"]),
    runGit(repoPath, ["diff", "--no-ext-diff", "--binary"]),
    readTextIfExists(path.join(repoPath, ".git", "HEAD"))
  ]);
  return sha256([...inputs, ...commandStats].join("\n"));
}
