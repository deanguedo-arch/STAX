import { buildRepoOnboardingCard, formatRepoOnboardingCard } from "../src/projectControl/RepoOnboardingAutopilot.js";

function getFlag(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const repoPath = getFlag(argv, "--path");
  const repoFullName = getFlag(argv, "--repo");
  const archetypeName = getFlag(argv, "--archetype");

  if (!repoPath && !repoFullName && !archetypeName) {
    throw new Error("Usage: tsx scripts/repoOnboardingAutopilot.ts [--path <repoPath>] [--repo owner/name] [--archetype <name>]");
  }

  const card = await buildRepoOnboardingCard({ repoPath, repoFullName, archetypeName });
  process.stdout.write(`${formatRepoOnboardingCard(card)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
