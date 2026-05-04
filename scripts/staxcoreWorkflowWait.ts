import { fetchStaxcoreWorkflowStatus } from "../src/campaign/StaxcoreWorkflowStatus.js";
import { waitForStaxcoreWorkflow } from "../src/campaign/StaxcoreWorkflowWait.js";

type CliArgs = {
  repoFullName?: string;
  workflowId?: string;
  perPage?: number;
  timeoutMs?: number;
  intervalMs?: number;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if ((token === "--repo" || token === "--repo-full-name") && next) {
      args.repoFullName = next;
      index += 1;
      continue;
    }
    if ((token === "--workflow" || token === "--workflow-id") && next) {
      args.workflowId = next;
      index += 1;
      continue;
    }
    if ((token === "--limit" || token === "--per-page") && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) args.perPage = Math.trunc(parsed);
      index += 1;
      continue;
    }
    if (token === "--timeout-ms" && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) args.timeoutMs = Math.trunc(parsed);
      index += 1;
      continue;
    }
    if (token === "--interval-ms" && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) args.intervalMs = Math.trunc(parsed);
      index += 1;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await waitForStaxcoreWorkflow({
    timeoutMs: args.timeoutMs,
    intervalMs: args.intervalMs,
    fetchStatus: async () =>
      fetchStaxcoreWorkflowStatus({
        repoFullName: args.repoFullName,
        workflowId: args.workflowId,
        perPage: args.perPage ?? 1
      })
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== "success") process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
