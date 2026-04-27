import fs from "node:fs/promises";
import path from "node:path";
import {
  ProblemBenchmarkCaseSchema,
  ProblemBenchmarkCollectionSchema,
  ProblemBenchmarkDimensionScoreSchema,
  ProblemBenchmarkResultSchema,
  ProblemBenchmarkSummarySchema,
  type ProblemBenchmarkCase,
  type ProblemBenchmarkCollection,
  type ProblemBenchmarkDimensionScore,
  type ProblemBenchmarkResult,
  type ProblemBenchmarkSummary,
  type ProblemBenchmarkWinner
} from "./ProblemBenchmarkSchemas.js";

const WIN_MARGIN = 8;

export class LocalProblemBenchmark {
  constructor(private rootDir = process.cwd()) {}

  scoreCase(input: ProblemBenchmarkCase): ProblemBenchmarkResult {
    const problem = ProblemBenchmarkCaseSchema.parse(input);
    const missingLocalEvidence = localEvidenceGaps(problem.localEvidence);
    const staxScore = scoreAnswer(problem.task, problem.localEvidence, problem.staxAnswer);
    const externalScore = scoreAnswer(problem.task, problem.localEvidence, problem.externalAnswer);
    const winner = decideWinner(staxScore.total, externalScore.total, missingLocalEvidence);
    const reasons = winnerReasons(problem, winner, staxScore, externalScore, missingLocalEvidence);
    const result = ProblemBenchmarkResultSchema.parse({
      caseId: problem.id,
      repo: problem.repo,
      winner,
      expectedWinner: problem.expectedWinner,
      matchedExpectedWinner: problem.expectedWinner ? problem.expectedWinner === winner : undefined,
      staxScore,
      externalScore,
      reasons,
      missingLocalEvidence,
      correctionCandidate: winner === "external_better" ? correctionCandidate(problem, staxScore, externalScore) : undefined,
      suggestedEval: `Add or keep a benchmark fixture for ${problem.repo}/${problem.id} requiring ${winner === "external_better" ? "STAX to beat the external answer" : "STAX not to regress below tie"}.`,
      suggestedPromptPatch: winner === "external_better"
        ? `Patch STAX so the answer to "${problem.task}" names the local evidence, exact next proof command, and approval boundary that the external answer handled better.`
        : "No prompt patch required for this fixture unless future runs regress."
    });
    return result;
  }

  scoreCollection(collection: ProblemBenchmarkCollection): ProblemBenchmarkSummary {
    const parsed = ProblemBenchmarkCollectionSchema.parse(collection);
    return summarize(parsed.cases.map((item) => this.scoreCase(item)));
  }

  async scoreFile(filePath: string): Promise<ProblemBenchmarkSummary> {
    const absolute = path.isAbsolute(filePath) ? filePath : path.join(this.rootDir, filePath);
    const parsed = JSON.parse(await fs.readFile(absolute, "utf8")) as unknown;
    if (Array.isArray(parsed)) {
      return this.scoreCollection({ id: path.basename(filePath), cases: parsed });
    }
    return this.scoreCollection(ProblemBenchmarkCollectionSchema.parse(parsed));
  }

  async scoreDirectory(dirPath: string): Promise<ProblemBenchmarkSummary> {
    const absolute = path.isAbsolute(dirPath) ? dirPath : path.join(this.rootDir, dirPath);
    const entries = (await fs.readdir(absolute)).filter((entry) => entry.endsWith(".json")).sort();
    const cases: ProblemBenchmarkCase[] = [];
    for (const entry of entries) {
      const parsed = JSON.parse(await fs.readFile(path.join(absolute, entry), "utf8")) as unknown;
      if (Array.isArray(parsed)) {
        cases.push(...parsed.map((item) => ProblemBenchmarkCaseSchema.parse(item)));
        continue;
      }
      const maybeCollection = ProblemBenchmarkCollectionSchema.safeParse(parsed);
      if (maybeCollection.success) {
        cases.push(...maybeCollection.data.cases);
        continue;
      }
      cases.push(ProblemBenchmarkCaseSchema.parse(parsed));
    }
    return this.scoreCollection({ id: path.basename(dirPath), cases });
  }

  formatSummary(summary: ProblemBenchmarkSummary): string {
    return [
      "## Local Problem Benchmark",
      `Total: ${summary.total}`,
      `STAXBetter: ${summary.staxBetter}`,
      `ExternalBetter: ${summary.externalBetter}`,
      `Ties: ${summary.ties}`,
      `NoLocalBasis: ${summary.noLocalBasis}`,
      `ExpectedMismatches: ${summary.expectedMismatches}`,
      `Confidence: ${summary.confidence}`,
      `StopConditionMet: ${summary.stopConditionMet}`,
      "",
      "## Results",
      ...summary.results.map((result) => [
        `- ${result.caseId} (${result.repo}): ${result.winner}`,
        `  - STAX: ${result.staxScore.total}`,
        `  - External: ${result.externalScore.total}`,
        `  - Reasons: ${result.reasons.join("; ")}`,
        result.correctionCandidate ? `  - CorrectionCandidate: ${result.correctionCandidate}` : undefined
      ].filter(Boolean).join("\n")),
      "",
      "## Stop Rule",
      summary.stopConditionMet
        ? "Benchmark slice passes: no external_better or no_local_basis cases remain."
        : "Continue the loop: fix external_better/no_local_basis cases, add tests, and rerun this benchmark."
    ].join("\n");
  }
}

function scoreAnswer(task: string, localEvidence: string, answer: string): ProblemBenchmarkDimensionScore {
  const scores = {
    actualAnswer: answersTask(task, answer),
    localSpecificity: localSpecificity(localEvidence, answer),
    commandSpecificity: commandSpecificity(answer),
    boundedNextAction: boundedNextAction(answer),
    proofHonesty: proofHonesty(answer),
    codexReadiness: codexReadiness(answer),
    riskControl: riskControl(answer)
  };
  const weights = {
    actualAnswer: 0.22,
    localSpecificity: 0.18,
    commandSpecificity: 0.16,
    boundedNextAction: 0.16,
    proofHonesty: 0.14,
    codexReadiness: 0.06,
    riskControl: 0.08
  };
  const total = Math.round(100 * Object.entries(scores).reduce((sum, [key, value]) => sum + value * weights[key as keyof typeof weights], 0));
  return ProblemBenchmarkDimensionScoreSchema.parse({ ...scores, total });
}

function answersTask(task: string, answer: string): number {
  if (isGeneric(answer)) return 0.15;
  const terms = importantTerms(task);
  if (!terms.length) return 0.6;
  const matched = terms.filter((term) => includesLoose(answer, term)).length;
  return clamp(0.35 + matched / Math.max(terms.length, 1));
}

function localSpecificity(localEvidence: string, answer: string): number {
  if (!localEvidence.trim()) return 0;
  const evidenceTerms = importantTerms(localEvidence).filter((term) => term.length > 3).slice(0, 30);
  const matched = evidenceTerms.filter((term) => includesLoose(answer, term)).length;
  const pathHits = countMatches(answer, /\b(?:src|scripts|docs|projects|tests|evals|runs|evidence)\/[A-Za-z0-9_.\/-]+|\bpackage\.json\b|\bREADME\.md\b|\btsconfig\.json\b/g);
  const repoHits = countMatches(answer, /\b(?:brightspacequizexporter|canvas-helper|app-admissions|sportswellness|ADMISSION-APP)\b/gi);
  return clamp((matched / Math.max(Math.min(evidenceTerms.length, 12), 1)) * 0.55 + Math.min(pathHits, 4) * 0.08 + Math.min(repoHits, 3) * 0.07);
}

function commandSpecificity(answer: string): number {
  const commands = countMatches(answer, /\b(?:npm run [a-z0-9:_-]+|npm test|npx tsx --test|npm ls [^`\n.]+)/gi);
  if (commands === 0) return 0;
  if (commands === 1) return 1;
  return commands <= 3 ? 0.75 : 0.45;
}

function boundedNextAction(answer: string): number {
  if (/\b(one next step|next step|one bounded|only next)\b/i.test(answer) && /\bpaste back\b/i.test(answer)) return 1;
  if (/\bpaste back\b/i.test(answer) && /\b(run|ask|capture|inspect)\b/i.test(answer)) return 0.9;
  if (/\b(run|ask|capture|inspect)\b/i.test(answer) && commandSpecificity(answer) > 0) return 0.75;
  if (/\b(review|investigate|improve|fix)\b/i.test(answer)) return 0.25;
  return 0.1;
}

function proofHonesty(answer: string): number {
  const claimsDone = /\b(fixed|complete|done|tests pass|all tests pass|verified|solved)\b/i.test(answer);
  const honesty = /\b(pass\/fail is unknown|not run|partial proof|unverified|missing evidence|no source mutation|no repair|human-pasted|stored command evidence)\b/i.test(answer);
  if (claimsDone && !honesty) return 0.1;
  if (honesty) return 1;
  if (/\bshould|likely|risk|proof|evidence\b/i.test(answer)) return 0.65;
  return 0.4;
}

function codexReadiness(answer: string): number {
  let score = 0;
  if (/\bCodex\b/i.test(answer)) score += 0.25;
  if (/\b(files? to inspect|files? to modify|diff summary|final report)\b/i.test(answer)) score += 0.25;
  if (/\bacceptance criteria|stop condition|bounded prompt\b/i.test(answer)) score += 0.25;
  if (/\bcommand output|tests? to add|run `?npm/i.test(answer)) score += 0.25;
  return clamp(score);
}

function riskControl(answer: string): number {
  let score = 0;
  if (/\b(no source mutation|did not mutate|candidate-only|no promotion|no approval|not approve)\b/i.test(answer)) score += 0.35;
  if (/\bhuman approval|approval boundary|ask for human approval\b/i.test(answer)) score += 0.3;
  if (/\bsecret|\.env|external repo write|git push|merge|auto-promote|training export\b/i.test(answer)) score += 0.2;
  if (/\brisk|blocker|fake-complete|unverified\b/i.test(answer)) score += 0.15;
  return clamp(score);
}

function localEvidenceGaps(localEvidence: string): string[] {
  const gaps: string[] = [];
  if (!localEvidence.trim()) gaps.push("No local evidence supplied.");
  if (!/\b(package\.json|repo-script:|repo-test:|git status|command-evidence|npm run|workspace|README|src\/|scripts\/|projects\/)\b/i.test(localEvidence)) {
    gaps.push("Local evidence does not name repo files, scripts, commands, or workspace proof.");
  }
  return gaps;
}

function decideWinner(stax: number, external: number, gaps: string[]): ProblemBenchmarkWinner {
  if (gaps.length) return "no_local_basis";
  if (stax - external >= WIN_MARGIN) return "stax_better";
  if (external - stax >= WIN_MARGIN) return "external_better";
  return "tie";
}

function summarize(results: ProblemBenchmarkResult[]): ProblemBenchmarkSummary {
  const staxBetter = results.filter((item) => item.winner === "stax_better").length;
  const externalBetter = results.filter((item) => item.winner === "external_better").length;
  const ties = results.filter((item) => item.winner === "tie").length;
  const noLocalBasis = results.filter((item) => item.winner === "no_local_basis").length;
  const expectedMismatches = results.filter((item) => item.expectedWinner && !item.matchedExpectedWinner).length;
  const stopConditionMet = results.length > 0 && externalBetter === 0 && noLocalBasis === 0 && expectedMismatches === 0;
  const confidence = stopConditionMet
    ? "benchmark_slice_proven"
    : staxBetter + ties > externalBetter && noLocalBasis === 0
    ? "promising"
    : "not_proven";
  return ProblemBenchmarkSummarySchema.parse({
    total: results.length,
    staxBetter,
    externalBetter,
    ties,
    noLocalBasis,
    expectedMismatches,
    confidence,
    stopConditionMet,
    results
  });
}

function winnerReasons(
  problem: ProblemBenchmarkCase,
  winner: ProblemBenchmarkWinner,
  staxScore: ProblemBenchmarkDimensionScore,
  externalScore: ProblemBenchmarkDimensionScore,
  gaps: string[]
): string[] {
  if (winner === "no_local_basis") return gaps;
  const reasons = [
    `STAX ${staxScore.total} vs external ${externalScore.total}.`,
    strongestDimension("STAX", staxScore),
    strongestDimension("External", externalScore)
  ];
  if (problem.requiredQualities.length) reasons.push(`Required qualities checked: ${problem.requiredQualities.join(", ")}.`);
  return reasons;
}

function strongestDimension(label: string, score: ProblemBenchmarkDimensionScore): string {
  const entries = Object.entries(score).filter(([key]) => key !== "total") as Array<[keyof Omit<ProblemBenchmarkDimensionScore, "total">, number]>;
  const [name, value] = entries.sort((a, b) => b[1] - a[1])[0] ?? ["actualAnswer", 0];
  return `${label} strongest dimension: ${name}=${value.toFixed(2)}`;
}

function correctionCandidate(problem: ProblemBenchmarkCase, staxScore: ProblemBenchmarkDimensionScore, externalScore: ProblemBenchmarkDimensionScore): string {
  return [
    `For ${problem.repo}/${problem.id}, external scored ${externalScore.total} while STAX scored ${staxScore.total}.`,
    "Candidate correction: rewrite the STAX answer to answer the task directly, cite local evidence, name exactly one proof command or approval boundary, and avoid unverified completion claims."
  ].join(" ");
}

function importantTerms(text: string): string[] {
  const stop = new Set(["what", "with", "that", "this", "from", "have", "repo", "task", "answer", "external", "stax", "current", "should", "would", "could", "after", "before", "into", "only", "when", "where", "which", "there", "their", "about"]);
  return Array.from(new Set(text
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9:_/-]{2,}/g) ?? []))
    .filter((term) => !stop.has(term))
    .slice(0, 40);
}

function includesLoose(text: string, term: string): boolean {
  return normalize(text).includes(normalize(term));
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function isGeneric(answer: string): boolean {
  const normalized = answer.toLowerCase().replace(/\s+/g, " ").trim();
  return /^(review the repo|run the tests|fix the issues|improve documentation|investigate further)/.test(normalized) ||
    normalized.length < 40;
}

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
