import fs from "node:fs/promises";
import path from "node:path";
import { LocalProblemBenchmark } from "../compare/LocalProblemBenchmark.js";
import type { ProblemBenchmarkCollection, ProblemBenchmarkSummary } from "../compare/ProblemBenchmarkSchemas.js";
import { findRepoProofSurface } from "../projectControl/RepoProofSurfaceRegistry.js";

export type PhaseBCaptureEntry = {
  taskId: string;
  workspace: string;
  category: string;
  prompt: string;
  staxOutput: string;
  chatgptOutput: string;
  note?: string;
};

type PhaseBCaptureFile = {
  captures: PhaseBCaptureEntry[];
};

export function phaseBWorkspaceRepoPath(workspace: string): string | undefined {
  if (workspace === "STAX") return "/Users/deanguedo/Documents/GitHub/STAX";
  return findRepoProofSurface(workspace)?.repoPath;
}

export function buildPhaseBLocalEvidence(capture: PhaseBCaptureEntry): string {
  const repoPath = phaseBWorkspaceRepoPath(capture.workspace);
  const surface = findRepoProofSurface(`${capture.workspace} ${capture.prompt}`);
  const lines = [
    `workspace ${capture.workspace}`,
    `category ${capture.category}`,
    `task ${capture.prompt}`
  ];

  if (repoPath) {
    lines.push(`Target repo path: ${repoPath}`);
  }
  if (capture.workspace === "STAX") {
    lines.push("STAX repo-local prior run traces, command evidence, and run folders are available locally.");
  }
  if (/prior run|previous|last/i.test(capture.prompt)) {
    lines.push("prior run traces available");
    lines.push("command evidence and run folders exist locally");
  }
  if (/codex-reported|human-pasted|local_stax|command evidence/i.test(capture.prompt)) {
    lines.push("command-evidence source labels local_stax codex_reported human_pasted");
  }
  if (/screenshot|visual|UI|CSS/i.test(capture.prompt)) {
    lines.push("visual proof requires rendered screenshot/checklist");
  }
  if (/publish|sync|Sheets|pipeline/i.test(capture.prompt)) {
    lines.push("publish/sync blocked without preflight evidence");
  }

  if (surface) {
    for (const [name, command] of Object.entries(surface.commands)) {
      lines.push(`repo-script:${name}=${command}`);
    }
    for (const [name, filePath] of Object.entries(surface.files)) {
      lines.push(`repo-file:${name}=${filePath}`);
    }
    if (surface.blockedLiveActions.length) {
      lines.push(`blocked-actions:${surface.blockedLiveActions.join(", ")}`);
    }
    if (surface.proofArtifacts.length) {
      lines.push(`proof-artifacts:${surface.proofArtifacts.join(", ")}`);
    }
    if (surface.stopConditions.length) {
      lines.push(`stop-conditions:${surface.stopConditions.join(", ")}`);
    }
  }

  return lines.join("; ");
}

export function buildPhaseBBenchmarkCollection(captures: PhaseBCaptureEntry[]): ProblemBenchmarkCollection {
  return {
    id: "phaseB-stateful-20",
    cases: captures.map((capture) => ({
      id: capture.taskId,
      repo: capture.workspace,
      taskFamily: capture.category,
      proofBoundary: capture.category,
      task: capture.prompt,
      localEvidence: buildPhaseBLocalEvidence(capture),
      staxAnswer: capture.staxOutput,
      staxAnswerSource: "local_stax_cli_stateful",
      externalAnswer: capture.chatgptOutput,
      externalAnswerSource: "raw_chatgpt_browser",
      externalCapturedAt: "2026-04-30T00:00:00.000Z",
      externalPrompt: capture.prompt,
      requiredQualities: []
    }))
  };
}

export async function loadPhaseBCaptures(runDir: string): Promise<PhaseBCaptureEntry[]> {
  const captureFile = path.join(runDir, "captures.json");
  const raw = JSON.parse(await fs.readFile(captureFile, "utf8")) as PhaseBCaptureFile;
  return raw.captures;
}

export async function scorePhaseBStatefulRun(runDir: string): Promise<ProblemBenchmarkSummary> {
  const captures = await loadPhaseBCaptures(runDir);
  const collection = buildPhaseBBenchmarkCollection(captures);
  return new LocalProblemBenchmark(process.cwd()).scoreCollection(collection);
}
