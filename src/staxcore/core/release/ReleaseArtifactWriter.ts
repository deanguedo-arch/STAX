import fs from "node:fs/promises";
import path from "node:path";
import { createId, nowIso } from "../../shared/index.js";
import type { ReplayPipelineResult } from "../replay/replayPipeline.js";
import type { DoctrineComplianceReport } from "./DoctrineCompliance.js";
import type { ReleaseGateEvidence, ReleaseGateResult } from "./ReleaseGate.js";

export interface StaxCoreReleaseArtifact {
  artifactId: string;
  createdAt: string;
  doctrineVersion: string;
  workspace?: string;
  linkedRepoPath?: string;
  commandChecks: Array<{
    name: string;
    command: string;
    passed: boolean;
    exitCode: number;
    durationMs: number;
    stdoutPreview: string;
    stderrPreview: string;
  }>;
  evidence: ReleaseGateEvidence;
  replay: ReplayPipelineResult;
  releaseGate: ReleaseGateResult;
  doctrineCompliance: DoctrineComplianceReport;
}

export class ReleaseArtifactWriter {
  constructor(private rootDir: string) {}

  async write(args: {
    doctrineVersion: string;
    workspace?: string;
    linkedRepoPath?: string;
    commandChecks: StaxCoreReleaseArtifact["commandChecks"];
    evidence: ReleaseGateEvidence;
    replay: ReplayPipelineResult;
    releaseGate: ReleaseGateResult;
    doctrineCompliance: DoctrineComplianceReport;
  }): Promise<{ artifact: StaxCoreReleaseArtifact; path: string }> {
    const createdAt = nowIso();
    const artifact: StaxCoreReleaseArtifact = {
      artifactId: createId("staxcore_release"),
      createdAt,
      doctrineVersion: args.doctrineVersion,
      workspace: args.workspace,
      linkedRepoPath: args.linkedRepoPath,
      commandChecks: args.commandChecks,
      evidence: args.evidence,
      replay: args.replay,
      releaseGate: args.releaseGate,
      doctrineCompliance: args.doctrineCompliance
    };

    const relPath = path.join(
      "runs",
      "staxcore_release",
      createdAt.slice(0, 10),
      `${artifact.artifactId}.json`
    );
    const fullPath = path.join(this.rootDir, relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, JSON.stringify(artifact, null, 2), "utf8");

    return { artifact, path: relPath };
  }
}
