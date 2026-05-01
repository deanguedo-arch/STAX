import { evaluatePromotionGate95 } from "../src/campaign/PromotionGate95.js";

async function main(): Promise<void> {
  const summary = await evaluatePromotionGate95();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.status !== "promotion_ready") process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
