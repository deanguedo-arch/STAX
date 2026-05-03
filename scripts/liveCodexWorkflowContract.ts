import { validateLiveCodexWorkflowContract } from "../src/campaign/LiveCodexWorkflowContract.js";

async function main(): Promise<void> {
  const summary = await validateLiveCodexWorkflowContract();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.status !== "workflow_contract_passed") process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
