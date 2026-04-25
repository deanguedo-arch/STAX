import fs from "node:fs/promises";
import path from "node:path";

export type RetentionResult = {
  dryRun: boolean;
  selectedRuns: string[];
  skippedRuns: Array<{ runPath: string; reason: string }>;
};

export class LearningRetention {
  constructor(private rootDir = process.cwd()) {}

  async run(input: { apply?: boolean; reason?: string; hotRetentionDays?: number } = {}): Promise<RetentionResult> {
    if (input.apply && !input.reason?.trim()) {
      throw new Error("Retention apply requires --reason.");
    }
    const days = input.hotRetentionDays ?? 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const selectedRuns: string[] = [];
    const skippedRuns: Array<{ runPath: string; reason: string }> = [];
    const runsDir = path.join(this.rootDir, "runs");
    try {
      for (const date of await fs.readdir(runsDir)) {
        const dateDir = path.join(runsDir, date);
        const stat = await fs.stat(dateDir);
        if (!stat.isDirectory()) continue;
        for (const runId of await fs.readdir(dateDir)) {
          const runPath = path.join(dateDir, runId);
          const runStat = await fs.stat(runPath);
          if (!runStat.isDirectory()) continue;
          if (runStat.mtimeMs > cutoff) {
            skippedRuns.push({ runPath, reason: "inside hot retention window" });
            continue;
          }
          const protectedReason = await this.protectedReason(runPath);
          if (protectedReason) {
            skippedRuns.push({ runPath, reason: protectedReason });
            continue;
          }
          selectedRuns.push(runPath);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (input.apply && selectedRuns.length > 0) {
      const archiveDir = path.join(this.rootDir, "learning", "events", "archive");
      await fs.mkdir(archiveDir, { recursive: true });
      await fs.appendFile(
        path.join(archiveDir, `${new Date().toISOString().slice(0, 7)}.trace_only.jsonl`),
        selectedRuns.map((runPath) => JSON.stringify({ runPath, compactedAt: new Date().toISOString(), reason: input.reason })).join("\n") + "\n",
        "utf8"
      );
    }
    return { dryRun: !input.apply, selectedRuns, skippedRuns };
  }

  private async protectedReason(runPath: string): Promise<string | undefined> {
    for (const file of ["learning_event.json", "trace.json"]) {
      try {
        const raw = await fs.readFile(path.join(runPath, file), "utf8");
        if (/"failureTypes"\s*:\s*\[\s*"[^\]]+"/.test(raw)) return "failure-linked run";
        if (/"learningQueues"\s*:\s*\[[^\]]*"(?!trace_only)/.test(raw)) return "queued learning artifact";
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    return undefined;
  }
}

