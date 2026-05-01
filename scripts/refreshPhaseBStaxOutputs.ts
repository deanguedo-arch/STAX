import fs from "node:fs/promises";
import path from "node:path";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { WorkspaceContext } from "../src/workspace/WorkspaceContext.js";
import {
  loadPhaseBCaptures,
  phaseBWorkspaceRepoPath,
  type PhaseBCaptureEntry
} from "../src/campaign/PhaseBStatefulBenchmark.js";

type CaptureFile = {
  captures: PhaseBCaptureEntry[];
};

function parseArgs(): { runId: string } {
  const runEq = process.argv.find((arg) => arg.startsWith("--run="));
  const runIndex = process.argv.indexOf("--run");
  const runId = runEq?.slice("--run=".length).trim() || (runIndex >= 0 ? process.argv[runIndex + 1]?.trim() : undefined);
  if (!runId) throw new Error("Missing --run=<runId>.");
  return { runId };
}

async function resolvePhaseBWorkspace(workspaceName: string): Promise<{
  workspace?: string;
  linkedRepoPath?: string;
}> {
  if (workspaceName === "STAX") {
    return {
      workspace: "STAX",
      linkedRepoPath: "/Users/deanguedo/Documents/GitHub/STAX"
    };
  }

  try {
    const resolved = await new WorkspaceContext().resolve({
      workspace: workspaceName,
      requireWorkspace: true
    });
    return {
      workspace: resolved.workspace,
      linkedRepoPath: resolved.linkedRepoPath
    };
  } catch {
    return {
      workspace: workspaceName,
      linkedRepoPath: phaseBWorkspaceRepoPath(workspaceName)
    };
  }
}

async function main(): Promise<void> {
  const { runId } = parseArgs();
  const runDir = path.join(process.cwd(), "fixtures", "real_use", "runs", runId);
  const capturesPath = path.join(runDir, "captures.json");
  const captures = await loadPhaseBCaptures(runDir);
  const runtime = await createDefaultRuntime();
  const refreshedAt = new Date().toISOString();

  for (const capture of captures) {
    const resolved = await resolvePhaseBWorkspace(capture.workspace);
    const output = await runtime.run(capture.prompt, [], {
      mode: "project_control",
      workspace: resolved.workspace,
      linkedRepoPath: resolved.linkedRepoPath
    });
    capture.staxOutput = output.output;
    capture.note = [
      capture.note?.trim(),
      `STAX output refreshed at ${refreshedAt} from workspace ${resolved.workspace ?? capture.workspace}.`,
      `Run: ${output.runId}`
    ].filter(Boolean).join("\n");
  }

  await fs.writeFile(
    capturesPath,
    JSON.stringify({ captures } satisfies CaptureFile, null, 2),
    "utf8"
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        status: "refreshed",
        runId,
        captureCount: captures.length,
        refreshedAt
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
