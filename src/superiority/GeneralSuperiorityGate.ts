import fs from "node:fs/promises";
import path from "node:path";
import { BaselineDateGate } from "../compare/BaselineDateGate.js";
import { ExternalSourceDiversityGate, promptHash } from "../compare/ExternalSourceDiversityGate.js";
import { FirstPassIntegrityGate } from "../compare/FirstPassIntegrityGate.js";
import { LocalProblemBenchmark } from "../compare/LocalProblemBenchmark.js";
import {
  ProblemBenchmarkCaseSchema,
  ProblemBenchmarkCollectionSchema,
  type ProblemBenchmarkCase,
  type ProblemBenchmarkCollection,
  type ProblemBenchmarkSummary
} from "../compare/ProblemBenchmarkSchemas.js";
import {
  GeneralSuperiorityReportSchema,
  GeneralSuperiorityThresholdsSchema,
  type GeneralSuperiorityReport,
  type GeneralSuperiorityThresholds
} from "./GeneralSuperioritySchemas.js";

const DEFAULT_THRESHOLDS = GeneralSuperiorityThresholdsSchema.parse({});

type LoadedCampaign = {
  id: string;
  cases: ProblemBenchmarkCase[];
};

export class GeneralSuperiorityGate {
  constructor(private rootDir = process.cwd(), private thresholds: GeneralSuperiorityThresholds = DEFAULT_THRESHOLDS) {}

  async evaluateFile(filePath: string): Promise<GeneralSuperiorityReport> {
    const loaded = await this.loadFile(filePath);
    return this.evaluateLoaded(loaded, await new LocalProblemBenchmark(this.rootDir).scoreFile(filePath));
  }

  async evaluateDirectory(dirPath: string): Promise<GeneralSuperiorityReport> {
    const loaded = await this.loadDirectory(dirPath);
    return this.evaluateLoaded(loaded, await new LocalProblemBenchmark(this.rootDir).scoreDirectory(dirPath));
  }

  evaluateCollection(collection: ProblemBenchmarkCollection): GeneralSuperiorityReport {
    const parsed = ProblemBenchmarkCollectionSchema.parse(collection);
    const cases = this.applyCollectionDefaults(parsed);
    const summary = new LocalProblemBenchmark(this.rootDir).scoreCollection(parsed);
    return this.evaluateLoaded({ id: parsed.id, cases }, summary);
  }

  format(report: GeneralSuperiorityReport): string {
    return [
      "## General Superiority Gate",
      `Status: ${report.status}`,
      `Comparisons: ${report.metrics.comparisons}/${report.thresholds.minComparisons}`,
      `BlindComparisons: ${report.metrics.blindComparisons}/${report.thresholds.minBlindComparisons}`,
      `WorkLanes: ${report.metrics.workLanes}/${report.thresholds.minWorkLanes}`,
      `TaskFamilies: ${report.metrics.taskFamilies}/${report.thresholds.minTaskFamilies}`,
      `ReposOrDomains: ${report.metrics.reposOrDomains}/${report.thresholds.minReposOrDomains}`,
      `ExternalSources: ${report.metrics.externalSources}/${report.thresholds.minExternalSources}`,
      `CaptureDates: ${report.metrics.captureDates}/${report.thresholds.minCaptureDates}`,
      `BaselineDateStatus: ${report.metrics.baselineDateStatus ?? "unknown"}`,
      `ExternalSourceDiversityStatus: ${report.metrics.externalSourceDiversityStatus ?? "unknown"}`,
      `ExternalBetter: ${report.metrics.externalBetter}`,
      `Ties: ${report.metrics.ties}`,
      `NoLocalBasis: ${report.metrics.noLocalBasis}`,
      `NoExternalBaseline: ${report.metrics.noExternalBaseline}`,
      `ExpectedMismatches: ${report.metrics.expectedMismatches}`,
      "",
      "## Covered Work Lanes",
      report.workLanesCovered.length ? report.workLanesCovered.map((item) => `- ${item}`).join("\n") : "- None",
      "",
      "## Gaps",
      report.gaps.length ? report.gaps.map((item) => `- ${item}`).join("\n") : "- None",
      "",
      "## Next Actions",
      ...report.nextActions.map((item) => `- ${item}`),
      "",
      "## Non-Winning Cases",
      report.nonWinningCases.length
        ? report.nonWinningCases.map((item) => `- ${item.caseId} (${item.repo}): ${item.winner}`).join("\n")
        : "- None"
    ].join("\n");
  }

  private evaluateLoaded(loaded: LoadedCampaign, summary: ProblemBenchmarkSummary): GeneralSuperiorityReport {
    const casesById = new Map(loaded.cases.map((item) => [item.id, item]));
    const workLanes = new Set(loaded.cases.map((item) => item.workLane ?? inferWorkLane(item)).filter(Boolean));
    const taskFamilies = new Set(loaded.cases.map((item) => item.taskFamily ?? inferTaskFamily(item)).filter(Boolean));
    const repos = new Set(summary.results.map((item) => item.repo));
    const firstPassIntegrity = summary.results.map((result) => {
      const problem = casesById.get(result.caseId);
      return {
        result,
        claimedBlind: isBlindCase(problem, result.externalCapturedAt),
        integrity: new FirstPassIntegrityGate().evaluate({
          fixtureId: result.caseId,
          firstPassLocked: problem?.firstPassLocked ?? isBlindCase(problem, result.externalCapturedAt),
          firstPassScoreRecorded: problem?.firstPassScoreRecorded ?? true,
          postCorrection: problem?.postCorrection ?? false,
          staxAnswerEditedAfterExternal: problem?.staxAnswerEditedAfterExternal ?? false,
          attemptedLockedFixtureOverwrite: problem?.attemptedLockedFixtureOverwrite ?? false,
          lockedFixturePath: problem?.lockedFixturePath,
          correctionCandidatePath: problem?.correctionCandidatePath,
          firstPassWinner: problem?.firstPassWinner ?? result.winner,
          currentWinner: result.winner,
          requestedClaimLevel: "blind_first_pass"
        })
      };
    });
    const baselineDate = new BaselineDateGate().evaluate({
      records: summary.results.map((result) => {
        const problem = casesById.get(result.caseId);
        return {
          caseId: result.caseId,
          externalCapturedAt: result.externalCapturedAt,
          externalAnswerSource: result.externalAnswerSource,
          captureContext: problem?.captureContext ?? result.externalAnswerSource,
          promptHash: problem?.promptHash ?? promptHash(result.externalPrompt),
          externalAnswerHash: problem?.externalAnswerHash
        };
      }),
      minUniqueDates: this.thresholds.minCaptureDates
    });
    const sourceDiversity = new ExternalSourceDiversityGate().evaluate({
      sources: summary.results.map((result) => {
        const problem = casesById.get(result.caseId);
        return {
          caseId: result.caseId,
          sourceType: problem?.sourceType,
          sourceId: problem?.sourceId ?? problem?.externalSource ?? result.externalAnswerSource,
          captureContext: problem?.captureContext ?? result.externalAnswerSource,
          promptHash: problem?.promptHash ?? promptHash(result.externalPrompt)
        };
      }),
      minUniqueSources: this.thresholds.minExternalSources
    });
    const blindComparisons = firstPassIntegrity.filter((item) => item.claimedBlind && item.integrity.firstPassEligible).length;
    const nonWinningCases = summary.results.filter((item) => item.winner !== "stax_better");
    const metrics = {
      comparisons: summary.total,
      blindComparisons,
      workLanes: workLanes.size,
      taskFamilies: taskFamilies.size,
      reposOrDomains: repos.size,
      externalSources: sourceDiversity.uniqueSourceCount,
      captureDates: baselineDate.uniqueDateCount,
      externalBetter: summary.externalBetter,
      ties: summary.ties,
      noLocalBasis: summary.noLocalBasis,
      noExternalBaseline: summary.noExternalBaseline,
      expectedMismatches: summary.expectedMismatches,
      baselineDateStatus: baselineDate.status,
      externalSourceDiversityStatus: sourceDiversity.status
    };
    const gaps = [
      ...gateGaps(metrics, this.thresholds),
      ...firstPassIntegrityGaps(firstPassIntegrity),
      ...baselineDate.blockingReasons.filter((item) => !/^Need external baselines captured/.test(item)),
      ...sourceDiversity.blockingReasons.filter((item) => !/^Need at least \d+ distinct external sources/.test(item))
    ];
    const status = gaps.length === 0 ? "superiority_candidate" : summary.stopConditionMet ? "campaign_slice" : "not_proven";
    return GeneralSuperiorityReportSchema.parse({
      target: "general_superiority",
      status,
      createdAt: new Date().toISOString(),
      thresholds: this.thresholds,
      metrics,
      benchmarkSummary: summary,
      gaps,
      nextActions: nextActionsFor(gaps, nonWinningCases),
      nonWinningCases,
      workLanesCovered: Array.from(workLanes).sort(),
      taskFamiliesCovered: Array.from(taskFamilies).sort(),
      externalSourcesCovered: sourceDiversity.sources.filter((item) => item.countsAsNewSource).map((item) => item.canonicalSourceKey).sort(),
      captureDatesCovered: baselineDate.captureDates
    });
  }

  private async loadDirectory(dirPath: string): Promise<LoadedCampaign> {
    const absolute = path.isAbsolute(dirPath) ? dirPath : path.join(this.rootDir, dirPath);
    const entries = (await fs.readdir(absolute)).filter((entry) => entry.endsWith(".json")).sort();
    const cases: ProblemBenchmarkCase[] = [];
    for (const entry of entries) {
      const loaded = await this.loadFile(path.join(absolute, entry));
      cases.push(...loaded.cases);
    }
    return { id: path.basename(dirPath), cases };
  }

  private async loadFile(filePath: string): Promise<LoadedCampaign> {
    const absolute = path.isAbsolute(filePath) ? filePath : path.join(this.rootDir, filePath);
    const parsed = JSON.parse(await fs.readFile(absolute, "utf8")) as unknown;
    if (Array.isArray(parsed)) {
      return { id: path.basename(filePath), cases: parsed.map((item) => ProblemBenchmarkCaseSchema.parse(item)) };
    }
    const collection = ProblemBenchmarkCollectionSchema.parse(parsed);
    return { id: collection.id, cases: this.applyCollectionDefaults(collection) };
  }

  private applyCollectionDefaults(collection: ProblemBenchmarkCollection): ProblemBenchmarkCase[] {
    return collection.cases.map((item) => ProblemBenchmarkCaseSchema.parse({
      ...item,
      staxAnswerSource: item.staxAnswerSource ?? collection.staxAnswerSource,
      staxCapturedAt: item.staxCapturedAt ?? collection.staxCapturedAt,
      externalAnswerSource: item.externalAnswerSource ?? collection.externalAnswerSource,
      externalCapturedAt: item.externalCapturedAt ?? collection.externalCapturedAt,
      externalPrompt: item.externalPrompt ?? collection.externalPrompt,
      sourceType: item.sourceType ?? collection.sourceType,
      sourceId: item.sourceId ?? collection.sourceId,
      captureContext: item.captureContext ?? collection.captureContext,
      promptHash: item.promptHash ?? collection.promptHash,
      humanConfirmedNotDrifted: item.humanConfirmedNotDrifted ?? collection.humanConfirmedNotDrifted,
      requireHoldoutFreshness: item.requireHoldoutFreshness ?? collection.requireHoldoutFreshness,
      lockedFixturePath: item.lockedFixturePath ?? collection.lockedFixturePath ?? collection.lockedStaxFixture,
      postCorrection: item.postCorrection ?? collection.postCorrection,
      correctionCandidatePath: item.correctionCandidatePath ?? collection.correctionCandidatePath
    }));
  }
}

function gateGaps(metrics: GeneralSuperiorityReport["metrics"], thresholds: GeneralSuperiorityThresholds): string[] {
  const gaps: string[] = [];
  if (metrics.externalBetter > 0) gaps.push(`External baseline beat STAX in ${metrics.externalBetter} case(s).`);
  if (metrics.ties > 0) gaps.push(`STAX tied the external baseline in ${metrics.ties} case(s); ties do not prove superiority.`);
  if (metrics.noLocalBasis > 0) gaps.push(`${metrics.noLocalBasis} case(s) lacked enough local/source evidence to score.`);
  if (metrics.noExternalBaseline > 0) gaps.push(`${metrics.noExternalBaseline} case(s) lacked a valid captured external baseline.`);
  if (metrics.expectedMismatches > 0) gaps.push(`${metrics.expectedMismatches} case(s) did not match the expected winner.`);
  if (metrics.comparisons < thresholds.minComparisons) gaps.push(`Need at least ${thresholds.minComparisons} total comparisons; current ${metrics.comparisons}.`);
  if (metrics.blindComparisons < thresholds.minBlindComparisons) gaps.push(`Need at least ${thresholds.minBlindComparisons} locked-before-external blind comparisons; current ${metrics.blindComparisons}.`);
  if (metrics.workLanes < thresholds.minWorkLanes) gaps.push(`Need at least ${thresholds.minWorkLanes} broad work lanes; current ${metrics.workLanes}.`);
  if (metrics.taskFamilies < thresholds.minTaskFamilies) gaps.push(`Need at least ${thresholds.minTaskFamilies} task families; current ${metrics.taskFamilies}.`);
  if (metrics.reposOrDomains < thresholds.minReposOrDomains) gaps.push(`Need at least ${thresholds.minReposOrDomains} repos/domains; current ${metrics.reposOrDomains}.`);
  if (metrics.externalSources < thresholds.minExternalSources) gaps.push(`Need at least ${thresholds.minExternalSources} external sources or capture contexts; current ${metrics.externalSources}.`);
  if (metrics.captureDates < thresholds.minCaptureDates) gaps.push(`Need external baselines captured on at least ${thresholds.minCaptureDates} dates; current ${metrics.captureDates}.`);
  return gaps;
}

function nextActionsFor(gaps: string[], nonWinningCases: GeneralSuperiorityReport["nonWinningCases"]): string[] {
  if (gaps.length === 0) return ["Treat as a superiority candidate, then challenge it with another fresh external baseline before product claims."];
  const actions = new Set<string>();
  if (nonWinningCases.length) actions.add("Convert every external_better or tie case into correction and eval candidates before rerunning.");
  if (gaps.some((item) => item.includes("blind comparisons"))) actions.add("Generate fresh blind tasks across non-repo work lanes, lock STAX answers first, then capture external answers separately.");
  if (gaps.some((item) => item.includes("first-pass integrity"))) actions.add("Add locked first-pass fixture metadata and preserve first-pass winner history before using blind comparison counts.");
  if (gaps.some((item) => item.includes("work lanes"))) actions.add("Add tasks for strategy, creative ideation, teaching, research synthesis, writing/editing, planning, tool/document work, memory, and messy judgment.");
  if (gaps.some((item) => item.includes("external sources") || item.includes("dates"))) actions.add("Capture external baselines from at least two contexts across at least three dates.");
  if (gaps.some((item) => item.includes("local/source evidence"))) actions.add("Add source evidence or mark the case out of scope before scoring.");
  if (gaps.some((item) => item.includes("external baseline"))) actions.add("Recapture drifted or missing external answers with the baseline prompt.");
  return Array.from(actions);
}

function firstPassIntegrityGaps(
  items: Array<{
    result: ProblemBenchmarkSummary["results"][number];
    claimedBlind: boolean;
    integrity: ReturnType<FirstPassIntegrityGate["evaluate"]>;
  }>
): string[] {
  return items
    .filter((item) => item.claimedBlind && !item.integrity.firstPassEligible)
    .map((item) => `Blind comparison first-pass integrity gap for ${item.result.caseId}: ${item.integrity.reasons.join("; ") || "not first-pass eligible"}.`);
}

function isBlindCase(problem: ProblemBenchmarkCase | undefined, externalCapturedAt: string | undefined): boolean {
  if (!problem) return false;
  if (problem.blind === true) return true;
  if (!problem.staxCapturedAt || !externalCapturedAt) return false;
  return Date.parse(problem.staxCapturedAt) <= Date.parse(externalCapturedAt);
}

function inferTaskFamily(problem: ProblemBenchmarkCase): string {
  return problem.id
    .replace(/^(brightspace|canvas|admissions|app|course|stax|repo|budgetwars|converter)[_-]/i, "")
    .replace(/_[0-9]+$/i, "");
}

function inferWorkLane(problem: ProblemBenchmarkCase): string {
  const text = `${problem.repo} ${problem.id} ${problem.task}`.toLowerCase();
  if (/\b(strategy|product|business|priority|prioritization|roadmap)\b/.test(text)) return "strategy";
  if (/\bcreative|ideation|story|voice|analogy|design\b/.test(text)) return "creative_ideation";
  if (/\bteach|course|lesson|student|assessment|canvas|brightspace|admission\b/.test(text)) return "teaching_education";
  if (/\bresearch|synthesis|compare|literature|source\b/.test(text)) return "research_synthesis";
  if (/\bwrite|edit|copy|memo|email|document\b/.test(text)) return "writing_editing";
  if (/\bplan|next|sequence|schedule|decision\b/.test(text)) return "planning";
  if (/\bcode|codex|implement|fix|test|repo|script|build|validate|export|ingest\b/.test(text)) return "local_repo";
  if (/\bmemory|preference|project state|remember\b/.test(text)) return "memory";
  if (/\bbrowser|spreadsheet|slide|docx|tool\b/.test(text)) return "tool_work";
  if (/\beval|benchmark|self|improve|superiority|holdout\b/.test(text)) return "self_improvement";
  return "messy_judgment";
}
