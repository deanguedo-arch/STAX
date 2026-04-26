import fs from "node:fs/promises";
import path from "node:path";
import { getAutonomyProfile, type AutonomyProfile } from "./AutonomyProfile.js";
import { CodexHandoffWorker } from "./CodexHandoffWorker.js";
import { CurriculumWorker } from "./CurriculumWorker.js";
import { FailureMiner } from "./FailureMiner.js";
import { LabMetrics } from "./LabMetrics.js";
import { LabRunner } from "./LabRunner.js";
import {
  LabCycleRecordSchema,
  LearningLabDomainSchema,
  ensureLabDirs,
  labId,
  relativeLabPath,
  type LabCycleRecord,
  type LabReleaseGateStatus,
  type LearningLabDomain,
  type PatchProposal
} from "./LearningWorker.js";
import { PatchPlanner } from "./PatchPlanner.js";
import { RedTeamGenerator } from "./RedTeamGenerator.js";
import { ReleaseGate } from "./ReleaseGate.js";
import { ScenarioGenerator } from "./ScenarioGenerator.js";
import { VerificationWorker } from "./VerificationWorker.js";

export class LabOrchestrator {
  constructor(private rootDir = process.cwd()) {}

  async go(input: {
    profile: string;
    cycles: number;
    domain: string;
    count: number;
    executeVerification?: boolean;
  }): Promise<{ path: string; cycles: LabCycleRecord[] }> {
    await ensureLabDirs(this.rootDir);
    const profile = getAutonomyProfile(input.profile);
    const domain = LearningLabDomainSchema.parse(input.domain);
    const cycles = this.validCycles(input.cycles);
    const count = this.validCount(input.count);
    const records: LabCycleRecord[] = [];
    for (let index = 0; index < cycles; index += 1) {
      records.push(await this.runCycle({ profile, domain, count, executeVerification: Boolean(input.executeVerification) }));
    }
    await new LabMetrics(this.rootDir).report();
    const summaryFile = path.join(this.rootDir, "learning", "lab", "cycles", `go-${labId(profile.name)}.json`);
    await fs.writeFile(summaryFile, JSON.stringify(records, null, 2), "utf8");
    return { path: relativeLabPath(this.rootDir, summaryFile), cycles: records };
  }

  private async runCycle(input: {
    profile: AutonomyProfile;
    domain: LearningLabDomain;
    count: number;
    executeVerification: boolean;
  }): Promise<LabCycleRecord> {
    const artifactPaths: string[] = [];
    const scenarioFiles: string[] = [];
    let scenariosGenerated = 0;
    if (input.domain === "redteam_governance") {
      const redteam = await new RedTeamGenerator(this.rootDir).generate({ count: input.count });
      artifactPaths.push(redteam.path);
      scenarioFiles.push(redteam.path);
      scenariosGenerated += redteam.scenarioSet.scenarios.length;
    } else {
      const curriculum = await new CurriculumWorker(this.rootDir).generate({ domain: input.domain, count: input.count });
      const scenarios = await new ScenarioGenerator(this.rootDir).generate({ curriculumPath: curriculum.path });
      artifactPaths.push(curriculum.path, scenarios.path);
      scenarioFiles.push(scenarios.path);
      scenariosGenerated += scenarios.scenarioSet.scenarios.length;
      if (input.profile.name !== "cautious") {
        const redteam = await new RedTeamGenerator(this.rootDir).generate({ count: Math.min(input.count, 5) });
        artifactPaths.push(redteam.path);
        scenarioFiles.push(redteam.path);
        scenariosGenerated += redteam.scenarioSet.scenarios.length;
      }
    }

    const runner = new LabRunner(this.rootDir);
    const labRuns = [];
    for (const file of scenarioFiles) {
      labRuns.push(
        await runner.runFile({
          file,
          createCandidates: input.profile.canCreateCandidates
        })
      );
    }
    artifactPaths.push(...labRuns.map((run) => run.path));
    const failures = (await new FailureMiner(this.rootDir).mine({ records: labRuns.map((run) => run.record) })).clusters;
    const candidatesCreated = labRuns
      .flatMap((run) => run.record.results)
      .flatMap((result) => result.queuesCreated)
      .filter((item) => item.startsWith("learning/lab/candidates/"));

    const patchRecords = input.profile.canCreatePatchProposals
      ? await new PatchPlanner(this.rootDir).plan({ clusters: failures })
      : [];
    artifactPaths.push(...patchRecords.flatMap((record) => [record.path, record.markdownPath]));

    const handoffRecords = input.profile.canCreateHandoffs
      ? await Promise.all(patchRecords.map((record) => new CodexHandoffWorker(this.rootDir).create({ patch: record.proposal })))
      : [];
    artifactPaths.push(...handoffRecords.map((record) => record.path));

    const verificationRecords = input.profile.canRunVerification
      ? await Promise.all(
          patchRecords.map((record) =>
            new VerificationWorker(this.rootDir).verify({
              patchId: record.proposal.patchId,
              commands: ["npm run typecheck"],
              execute: input.executeVerification
            })
          )
        )
      : [];
    artifactPaths.push(...verificationRecords.map((record) => record.path));

    const gateRecords = patchRecords.length
      ? await Promise.all(
          patchRecords.map((record) => {
            const verification = verificationRecords.find((item) => item.result.patchId === record.proposal.patchId)?.result;
            return new ReleaseGate(this.rootDir).evaluate({ patch: record.proposal, verification });
          })
        )
      : [];
    artifactPaths.push(...gateRecords.map((record) => record.path));

    const cycle = LabCycleRecordSchema.parse({
      cycleId: labId("cycle"),
      profile: input.profile.name,
      domain: input.domain,
      createdAt: new Date().toISOString(),
      scenariosGenerated,
      scenariosRun: labRuns.flatMap((run) => run.record.results).length,
      failures,
      candidatesCreated,
      patchesProposed: patchRecords.map((record) => record.path),
      handoffsCreated: handoffRecords.map((record) => record.path),
      verificationResults: verificationRecords.map((record) => record.path),
      releaseGate: this.releaseGateStatus({
        failures: failures.length,
        patchProposals: patchRecords.map((record) => record.proposal),
        gates: gateRecords.map((record) => record.result.status)
      }),
      artifactPaths
    });
    const file = path.join(this.rootDir, "learning", "lab", "cycles", `${cycle.cycleId}.json`);
    await fs.writeFile(file, JSON.stringify(cycle, null, 2), "utf8");
    return cycle;
  }

  private releaseGateStatus(input: {
    failures: number;
    patchProposals: PatchProposal[];
    gates: LabReleaseGateStatus[];
  }): LabReleaseGateStatus {
    if (input.gates.includes("blocked")) return "blocked";
    if (input.gates.includes("needs_human")) return "needs_human";
    if (input.failures > 0 && input.patchProposals.length === 0) return "needs_human";
    return "safe_to_review";
  }

  private validCycles(value: number): number {
    if (!Number.isInteger(value) || value < 1 || value > 10) {
      throw new Error("Lab go cycles must be an integer from 1 to 10.");
    }
    return value;
  }

  private validCount(value: number): number {
    if (!Number.isInteger(value) || value < 1 || value > 250) {
      throw new Error("Lab go count must be an integer from 1 to 250.");
    }
    return value;
  }
}
