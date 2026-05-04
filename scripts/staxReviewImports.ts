import { listSidecarImportCandidates, renderSidecarImportReview } from "../src/learning/SidecarImportReview.js";

async function main(): Promise<void> {
  const json = process.argv.includes("--json");
  const candidates = await listSidecarImportCandidates(process.cwd());
  process.stdout.write(json ? `${JSON.stringify(candidates, null, 2)}\n` : renderSidecarImportReview(candidates));
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
