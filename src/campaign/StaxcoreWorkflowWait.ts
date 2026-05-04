import type { StaxcoreWorkflowStatusResult } from "./StaxcoreWorkflowStatus.js";

type SleepLike = (ms: number) => Promise<void>;

export type WaitForStaxcoreWorkflowOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  fetchStatus: () => Promise<StaxcoreWorkflowStatusResult>;
  sleepImpl?: SleepLike;
};

export type StaxcoreWaitPoll = {
  checkedAt: string;
  status: StaxcoreWorkflowStatusResult["status"];
  latestRunId: number | null;
  latestRunStatus: string | null;
  latestRunConclusion: string | null;
  message?: string;
};

export type StaxcoreWaitResult = {
  status: "success" | "failed" | "timed_out";
  startedAt: string;
  finishedAt: string;
  timeoutMs: number;
  intervalMs: number;
  polls: StaxcoreWaitPoll[];
  latest: StaxcoreWorkflowStatusResult | null;
  message: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForStaxcoreWorkflow(
  options: WaitForStaxcoreWorkflowOptions
): Promise<StaxcoreWaitResult> {
  const timeoutMs =
    Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0 ? Math.trunc(options.timeoutMs as number) : 600_000;
  const intervalMs =
    Number.isFinite(options.intervalMs) && (options.intervalMs ?? 0) > 0 ? Math.trunc(options.intervalMs as number) : 15_000;
  const sleepImpl = options.sleepImpl ?? sleep;
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  const polls: StaxcoreWaitPoll[] = [];
  let latest: StaxcoreWorkflowStatusResult | null = null;

  while (Date.now() - startedAtMs <= timeoutMs) {
    latest = await options.fetchStatus();
    polls.push({
      checkedAt: latest.checkedAt,
      status: latest.status,
      latestRunId: latest.latestRun?.id ?? null,
      latestRunStatus: latest.latestRun?.status ?? null,
      latestRunConclusion: latest.latestRun?.conclusion ?? null,
      message: latest.message
    });

    if (latest.status === "ok" && latest.latestRun?.status === "completed") {
      const finishedAt = new Date().toISOString();
      if (latest.latestRun.conclusion === "success") {
        return {
          status: "success",
          startedAt,
          finishedAt,
          timeoutMs,
          intervalMs,
          polls,
          latest,
          message: `Run ${latest.latestRun.id} completed successfully.`
        };
      }
      return {
        status: "failed",
        startedAt,
        finishedAt,
        timeoutMs,
        intervalMs,
        polls,
        latest,
        message: `Run ${latest.latestRun.id} completed with conclusion ${latest.latestRun.conclusion ?? "null"}.`
      };
    }

    await sleepImpl(intervalMs);
  }

  return {
    status: "timed_out",
    startedAt,
    finishedAt: new Date().toISOString(),
    timeoutMs,
    intervalMs,
    polls,
    latest,
    message: "Timed out while waiting for staxcore-strict workflow completion."
  };
}
