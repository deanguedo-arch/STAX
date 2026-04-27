import fs from "node:fs/promises";
import path from "node:path";
import {
  StrategicBenchmarkCaseSchema,
  StrategicBenchmarkCollectionSchema,
  StrategicBenchmarkScoreSchema,
  StrategicBenchmarkSummarySchema,
  type StrategicBenchmarkCase,
  type StrategicBenchmarkCollection,
  type StrategicBenchmarkScore,
  type StrategicBenchmarkSummary,
  type StrategicBenchmarkWinner
} from "./StrategicBenchmarkSchemas.js";

const WIN_MARGIN = 8;
const MIN_CANDIDATE_CASES = 25;
const MIN_WORK_LANES = 5;
const MIN_CAPTURE_DATES = 2;

export class StrategicBenchmark {
  constructor(private rootDir = process.cwd()) {}

  scoreCase(input: StrategicBenchmarkCase) {
    const problem = StrategicBenchmarkCaseSchema.parse(input);
    const staxScore = scoreStrategicAnswer(problem.staxAnswer);
    const externalScore = scoreStrategicAnswer(problem.externalAnswer);
    const externalBaselineIssues = externalBaselineIssuesFor(problem);
    const externalGap = externalBaselineIssues.length > 0;
    const winner = decideWinner(staxScore.total, externalScore.total, externalGap);
    return {
      caseId: problem.id,
      workLane: problem.workLane,
      winner,
      expectedWinner: problem.expectedWinner,
      matchedExpectedWinner: problem.expectedWinner ? problem.expectedWinner === winner : undefined,
      staxScore,
      externalScore,
      externalBaselineIssues,
      reasons: reasonsFor(winner, staxScore, externalScore, externalBaselineIssues),
      correctionCandidate: winner === "external_better"
        ? `Improve strategy answer for ${problem.id}: add option comparison, tradeoffs, evidence discipline, next proof step, and kill criteria.`
        : undefined
    };
  }

  scoreCollection(collection: StrategicBenchmarkCollection): StrategicBenchmarkSummary {
    const parsed = StrategicBenchmarkCollectionSchema.parse(collection);
    const cases = parsed.cases.map((item) => StrategicBenchmarkCaseSchema.parse({
      ...item,
      staxCapturedAt: item.staxCapturedAt ?? parsed.staxCapturedAt,
      externalCapturedAt: item.externalCapturedAt ?? parsed.externalCapturedAt,
      externalAnswerSource: item.externalAnswerSource ?? parsed.externalAnswerSource
    }));
    return summarize(cases.map((item) => this.scoreCase(item)), cases);
  }

  async scoreFile(filePath: string): Promise<StrategicBenchmarkSummary> {
    const absolute = path.isAbsolute(filePath) ? filePath : path.join(this.rootDir, filePath);
    const parsed = StrategicBenchmarkCollectionSchema.parse(JSON.parse(await fs.readFile(absolute, "utf8")));
    return this.scoreCollection(parsed);
  }

  async scoreDirectory(dirPath = "fixtures/strategy_benchmark"): Promise<StrategicBenchmarkSummary> {
    const absolute = path.isAbsolute(dirPath) ? dirPath : path.join(this.rootDir, dirPath);
    const entries = (await fs.readdir(absolute)).filter((entry) => entry.endsWith(".json")).sort();
    const cases: StrategicBenchmarkCase[] = [];
    for (const entry of entries) {
      const parsed = StrategicBenchmarkCollectionSchema.parse(JSON.parse(await fs.readFile(path.join(absolute, entry), "utf8")));
      cases.push(...parsed.cases.map((item) => StrategicBenchmarkCaseSchema.parse({
        ...item,
        staxCapturedAt: item.staxCapturedAt ?? parsed.staxCapturedAt,
        externalCapturedAt: item.externalCapturedAt ?? parsed.externalCapturedAt,
        externalAnswerSource: item.externalAnswerSource ?? parsed.externalAnswerSource
      })));
    }
    return this.scoreCollection({ id: path.basename(dirPath), cases });
  }

  format(summary: StrategicBenchmarkSummary): string {
    return [
      "## Strategic Benchmark",
      `Status: ${summary.status}`,
      `Total: ${summary.total}`,
      `STAXBetter: ${summary.staxBetter}`,
      `ExternalBetter: ${summary.externalBetter}`,
      `Ties: ${summary.ties}`,
      `NoExternalBaseline: ${summary.noExternalBaseline}`,
      `WorkLanes: ${summary.workLanes}`,
      `CaptureDates: ${summary.captureDates}`,
      "",
      "## Gaps",
      summary.gaps.length ? summary.gaps.map((gap) => `- ${gap}`).join("\n") : "- None",
      "",
      "## Results",
      ...summary.results.map((result) => `- ${result.caseId} (${result.workLane}): ${result.winner}; STAX=${result.staxScore.total}; External=${result.externalScore.total}`)
    ].join("\n");
  }
}

export function scoreStrategicAnswer(answer: string): StrategicBenchmarkScore {
  const scores = {
    optionQuality: optionQuality(answer),
    decisionClarity: decisionClarity(answer),
    tradeoffClarity: tradeoffClarity(answer),
    redTeamDepth: redTeamDepth(answer),
    evidenceDiscipline: evidenceDiscipline(answer),
    proofStep: proofStep(answer),
    killCriteria: killCriteria(answer),
    providerHonesty: providerHonesty(answer)
  };
  const weights = {
    optionQuality: 0.17,
    decisionClarity: 0.16,
    tradeoffClarity: 0.14,
    redTeamDepth: 0.12,
    evidenceDiscipline: 0.14,
    proofStep: 0.12,
    killCriteria: 0.1,
    providerHonesty: 0.05
  };
  const total = Math.round(100 * Object.entries(scores).reduce((sum, [key, value]) => sum + value * weights[key as keyof typeof weights], 0));
  return StrategicBenchmarkScoreSchema.parse({ ...scores, total });
}

function optionQuality(answer: string): number {
  const options = section(answer, "## Options Considered") || answer;
  const count = (options.match(/^\s*(?:\d+\.|-)\s+/gm) ?? []).length;
  if (count >= 4) return 1;
  if (count >= 3) return 0.85;
  if (count >= 2) return 0.65;
  return 0.1;
}

function decisionClarity(answer: string): number {
  if (/\b## Decision\b[\s\S]*\bSelect\b/i.test(answer) || /\bI would choose\b/i.test(answer)) return 1;
  if (/\b(best option|recommend)\b/i.test(answer)) return 0.65;
  return 0.15;
}

function tradeoffClarity(answer: string): number {
  let score = 0;
  if (/\bopportunity cost\b/i.test(answer)) score += 0.35;
  if (/\breversib(le|ility)|costly_to_reverse|hard_to_reverse\b/i.test(answer)) score += 0.3;
  if (/\brejected|alternative|beats the alternatives|tradeoff\b/i.test(answer)) score += 0.35;
  return Math.min(1, score);
}

function redTeamDepth(answer: string): number {
  const count = (answer.match(/\b(red-team|failure mode|risk|could fail|overfit|generic)\b/gi) ?? []).length;
  return Math.min(1, count / 4);
}

function evidenceDiscipline(answer: string): number {
  let score = 0;
  if (/\bevidence used\b/i.test(answer)) score += 0.35;
  if (/\bevidence missing|missing evidence|unknown|not proven\b/i.test(answer)) score += 0.35;
  if (!/\b(definitely|obviously|proves everything|guaranteed)\b/i.test(answer)) score += 0.3;
  return Math.min(1, score);
}

function proofStep(answer: string): number {
  if (/\bnext proof step\b[\s\S]*\b(npm run|compare|capture|paste back|benchmark|eval)\b/i.test(answer)) return 1;
  if (/\b(npm run|compare|capture|benchmark|eval)\b/i.test(answer)) return 0.65;
  return 0.1;
}

function killCriteria(answer: string): number {
  if (/\bkill criteria\b[\s\S]*\b(if|fail|stop|do not expand|pause)\b/i.test(answer)) return 1;
  if (/\bstop condition|failure threshold\b/i.test(answer)) return 0.65;
  return 0;
}

function providerHonesty(answer: string): number {
  if (/\bcapability warning|provider capability|limited_mock|strong external|strong-model\b/i.test(answer)) return 1;
  return 0.4;
}

function externalBaselineIssuesFor(problem: StrategicBenchmarkCase): string[] {
  const answer = problem.externalAnswer.trim();
  const issues: string[] = [];
  if (!answer) issues.push("External answer is missing.");
  if (/\b(as an ai language model|i need more context|it depends)\b/i.test(answer)) {
    issues.push("External answer is a generic non-answer.");
  }
  if (answer.split(/\s+/).length < 20) issues.push("External answer is too short to score as a strategic baseline.");
  if (driftedFromBroadStrategy(problem, answer)) {
    issues.push("External answer drifted into local repo-operator evidence instead of answering the broad strategy task.");
  }
  return issues;
}

function driftedFromBroadStrategy(problem: StrategicBenchmarkCase, answer: string): boolean {
  const taskText = `${problem.task} ${problem.context}`.toLowerCase();
  const asksBroadStrategy = /\b(broad|strategic|strategy|creative|product|cross-domain|big-picture|ambiguous)\b/.test(taskText);
  if (!asksBroadStrategy) return false;
  const driftTerms = [
    /\blocal repo operator\b/i,
    /\bbounded local repo\b/i,
    /\bdogfood report\b/i,
    /\bcommand evidence\b/i,
    /\bfake-complete\b/i,
    /\bRAX_REAL_TASK_DOGFOOD_REPORT\b/i,
    /\bRAX_LOCAL_PROBLEM_BENCHMARK_REPORT\b/i,
    /\b50-case\b/i,
    /\bapp-admissions\b/i,
    /\bbrightspacequizexporter\b/i,
    /\bcanvas-helper\b/i
  ];
  const driftCount = driftTerms.filter((pattern) => pattern.test(answer)).length;
  const hasCurrentStrategicAnswer = /\b(strategic deliberation|strategic benchmark|broad strategic reasoning|one next patch|next implementation slice)\b/i.test(answer);
  return driftCount >= 3 && !hasCurrentStrategicAnswer;
}

function decideWinner(stax: number, external: number, externalGap: boolean): StrategicBenchmarkWinner {
  if (externalGap) return "no_external_baseline";
  if (stax - external >= WIN_MARGIN) return "stax_better";
  if (external - stax >= WIN_MARGIN) return "external_better";
  return "tie";
}

function summarize(results: ReturnType<StrategicBenchmark["scoreCase"]>[], cases: StrategicBenchmarkCase[]): StrategicBenchmarkSummary {
  const staxBetter = results.filter((item) => item.winner === "stax_better").length;
  const externalBetter = results.filter((item) => item.winner === "external_better").length;
  const ties = results.filter((item) => item.winner === "tie").length;
  const noExternalBaseline = results.filter((item) => item.winner === "no_external_baseline").length;
  const expectedMismatches = results.filter((item) => item.expectedWinner && !item.matchedExpectedWinner).length;
  const workLanes = new Set(cases.map((item) => item.workLane)).size;
  const captureDates = new Set(cases.map((item) => item.externalCapturedAt?.slice(0, 10)).filter(Boolean)).size;
  const gaps = gapsFor(results.length, workLanes, captureDates, externalBetter, ties, noExternalBaseline, expectedMismatches);
  const status = gaps.length
    ? "not_proven"
    : results.length >= MIN_CANDIDATE_CASES
      ? "broad_reasoning_candidate"
      : "strategy_slice";
  return StrategicBenchmarkSummarySchema.parse({
    total: results.length,
    staxBetter,
    externalBetter,
    ties,
    noExternalBaseline,
    expectedMismatches,
    workLanes,
    captureDates,
    status,
    gaps,
    results
  });
}

function gapsFor(total: number, workLanes: number, captureDates: number, externalBetter: number, ties: number, noExternalBaseline: number, expectedMismatches: number): string[] {
  const gaps: string[] = [];
  if (externalBetter) gaps.push(`External baseline beat STAX in ${externalBetter} strategic case(s).`);
  if (ties) gaps.push(`STAX tied the external baseline in ${ties} strategic case(s); ties do not prove broad reasoning superiority.`);
  if (noExternalBaseline) gaps.push(`${noExternalBaseline} strategic case(s) lacked a usable external baseline.`);
  if (expectedMismatches) gaps.push(`${expectedMismatches} strategic case(s) did not match expected winner.`);
  if (total < MIN_CANDIDATE_CASES) gaps.push(`Need at least ${MIN_CANDIDATE_CASES} strategic comparisons for a broad reasoning candidate; current ${total}.`);
  if (workLanes < MIN_WORK_LANES) gaps.push(`Need at least ${MIN_WORK_LANES} strategic work lanes; current ${workLanes}.`);
  if (captureDates < MIN_CAPTURE_DATES) gaps.push(`Need external captures on at least ${MIN_CAPTURE_DATES} dates; current ${captureDates}.`);
  return gaps;
}

function reasonsFor(winner: StrategicBenchmarkWinner, stax: StrategicBenchmarkScore, external: StrategicBenchmarkScore, externalBaselineIssues: string[]): string[] {
  if (externalBaselineIssues.length) return externalBaselineIssues;
  if (winner === "stax_better") return [`STAX score ${stax.total} beat external score ${external.total} by at least ${WIN_MARGIN}.`];
  if (winner === "external_better") return [`External score ${external.total} beat STAX score ${stax.total} by at least ${WIN_MARGIN}.`];
  return [`Scores were within ${WIN_MARGIN} points.`];
}

function section(output: string, heading: string): string {
  const start = output.indexOf(heading);
  if (start === -1) return "";
  const after = output.slice(start + heading.length);
  const next = after.search(/\n##\s+/);
  return next === -1 ? after : after.slice(0, next);
}
