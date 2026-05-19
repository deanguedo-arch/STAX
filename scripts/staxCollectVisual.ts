import { collectVisualEvidence, type VisualProofSource } from "../src/sidecar/VisualEvidenceCollector.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const repo = valueAfter(args, "--repo");
  const screenshotPath = valueAfter(args, "--path");
  const url = valueAfter(args, "--url");
  const description = valueAfter(args, "--description");
  const outputName = valueAfter(args, "--output");
  const viewport = valueAfter(args, "--viewport");
  const source = valueAfter(args, "--source") as VisualProofSource | undefined;
  const checklistItems = valuesAfter(args, "--checklist");
  if (!repo) throw new Error("Usage: npm run stax:collect-visual -- --repo <path> (--path <screenshot> | --url <url>) --description <text> [--checklist <item>]...");
  if (!description) throw new Error("--description is required.");
  const result = await collectVisualEvidence({
    repoPath: repo,
    screenshotPath,
    url,
    description,
    outputName,
    viewport,
    source,
    checklistItems
  });
  console.log(JSON.stringify(result, null, 2));
}

function valueAfter(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function valuesAfter(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name && args[index + 1]) values.push(args[index + 1]);
  }
  return values;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
