import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { stringifyProjectControlEvidencePacket } from "../src/projectControl/ProjectControlEvidencePacket.js";
import { fetchGitHubPullRequestArtifactPacket } from "../src/projectControl/GitHubPrArtifactAdapter.js";

type CliArgs = {
  repo?: string;
  pr?: number;
  task?: string;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.repo || !args.pr) {
    throw new Error("Usage: tsx scripts/auditLivePrArtifact.ts --repo owner/name --pr 123 [--task \"...\"]");
  }

  const task = args.task ?? "Audit this live GitHub PR artifact packet and produce a project-control verdict.";
  const fetched = await fetchGitHubPullRequestArtifactPacket({
    repoFullName: args.repo,
    prNumber: args.pr
  });

  const runtime = await createDefaultRuntime();
  const packet = stringifyProjectControlEvidencePacket({
    task,
    repo: args.repo,
    targetRepoPath: `/public/${args.repo}`,
    branch: fetched.packet.branch,
    baseSha: fetched.packet.baseBranch,
    headSha: fetched.packet.commitSha,
    changedFiles: [],
    commandEvidence: [],
    codexReport: "",
    visualEvidence: [],
    dataProofArtifacts: [],
    releaseProofArtifacts: [],
    humanApproval: [],
    pullRequestArtifact: fetched.packet
  });
  const output = await runtime.run(packet, [], { mode: "project_control" });

  process.stdout.write(
    `${JSON.stringify(
      {
        source: fetched.source,
        warnings: fetched.warnings,
        repo: args.repo,
        prNumber: args.pr,
        output: output.output
      },
      null,
      2
    )}\n`
  );
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--repo" && next) {
      args.repo = next;
      index += 1;
    } else if (token === "--pr" && next) {
      args.pr = Number(next);
      index += 1;
    } else if (token === "--task" && next) {
      args.task = next;
      index += 1;
    }
  }
  return args;
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
