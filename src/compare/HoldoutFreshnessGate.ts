import {
  HoldoutFreshnessInputSchema,
  HoldoutFreshnessResultSchema,
  type HoldoutFreshnessCase,
  type HoldoutFreshnessInput,
  type HoldoutFreshnessResult,
  type HoldoutTaskFamily
} from "./HoldoutFreshnessSchemas.js";

const SIMILARITY_BLOCK_THRESHOLD = 0.56;

export class HoldoutFreshnessGate {
  evaluate(input: HoldoutFreshnessInput): HoldoutFreshnessResult {
    const parsed = HoldoutFreshnessInputSchema.parse(input);
    const candidate = parsed.candidate;
    const taskFamily = inferTaskFamily(candidate);
    const proofBoundary = inferProofBoundary(candidate);
    const externalSource = candidate.externalSource ?? candidate.externalAnswerSource;
    const captureDate = (candidate.captureDate ?? candidate.externalCapturedAt)?.slice(0, 10);
    const blockingReasons: string[] = [];
    const freshnessReasons: string[] = [];

    if (parsed.requireLocalEvidence && !hasLocalEvidence(candidate.localEvidence)) {
      blockingReasons.push("Local evidence is missing; a holdout cannot be scored as fresh without local proof context.");
    }

    const similarities = parsed.existingCases.map((prior) => {
      const priorFamily = inferTaskFamily(prior);
      const priorBoundary = inferProofBoundary(prior);
      return {
        caseId: prior.id,
        similarity: taskSimilarity(candidate.task, prior.task),
        sameRepo: sameText(candidate.repo, prior.repo),
        sameTaskFamily: taskFamily === priorFamily,
        sameProofBoundary: sameText(proofBoundary, priorBoundary)
      };
    }).sort((left, right) => right.similarity - left.similarity);

    const tooSimilar = similarities.find((item) => item.similarity >= SIMILARITY_BLOCK_THRESHOLD);
    if (tooSimilar) {
      blockingReasons.push(`Task wording is too similar to existing case ${tooSimilar.caseId} (${tooSimilar.similarity.toFixed(2)} similarity).`);
    }

    const sameRepoFamilyBoundary = similarities.find((item) => item.sameRepo && item.sameTaskFamily && item.sameProofBoundary);
    if (sameRepoFamilyBoundary) {
      blockingReasons.push(`Same repo, task family, and proof boundary already exist in ${sameRepoFamilyBoundary.caseId}.`);
    }

    if (parsed.rejectRecycledExternalBaseline && externalSource && captureDate) {
      const recycled = parsed.existingCases.find((prior) => {
        const priorSource = prior.externalSource ?? prior.externalAnswerSource;
        const priorDate = (prior.captureDate ?? prior.externalCapturedAt)?.slice(0, 10);
        return sameText(externalSource, priorSource) && captureDate === priorDate;
      });
      if (recycled) {
        blockingReasons.push(`External baseline source/date is recycled from ${recycled.id}; do not use it for superiority freshness.`);
      }
    }

    if (isRenamedKnownGap(candidate.task)) {
      const matchingKnownGap = parsed.existingCases.find((prior) => isRenamedKnownGap(prior.task));
      if (matchingKnownGap) {
        blockingReasons.push(`Task is a renamed known-gap pattern already represented by ${matchingKnownGap.id}.`);
      }
    }

    if (!similarities.some((item) => item.sameRepo)) freshnessReasons.push("new repo");
    if (!similarities.some((item) => item.sameProofBoundary)) freshnessReasons.push("new proof boundary");
    if (!similarities.some((item) => item.sameTaskFamily)) freshnessReasons.push("new task family");
    if (!freshnessReasons.length && !blockingReasons.length) freshnessReasons.push("no blocking duplicate detected");

    return HoldoutFreshnessResultSchema.parse({
      caseId: candidate.id,
      repo: candidate.repo,
      taskFamily,
      proofBoundary,
      externalSource,
      captureDate,
      similarityToExistingCases: similarities.slice(0, 5),
      isFresh: blockingReasons.length === 0,
      freshnessReasons,
      blockingReasons
    });
  }
}

function inferTaskFamily(input: HoldoutFreshnessCase): HoldoutTaskFamily {
  if (input.taskFamily) return input.taskFamily;
  const text = `${input.id} ${input.task} ${input.sourceContext ?? ""}`.toLowerCase();
  if (/\bvisual|screenshot|rendered|layout|ui|css|checkmark|text fit\b/.test(text)) return "visual_evidence";
  if (/\bruntime|test|build|deploy|command output|exit code|script\b/.test(text)) return "runtime_evidence";
  if (/\bdeploy|release|environment|pages|hosting\b/.test(text)) return "deployment_boundary";
  if (/\bbaseline|external|drift|capture\b/.test(text)) return "baseline_drift";
  if (/\bstrategy|roadmap|product|creative|business\b/.test(text)) return "strategy";
  if (/\bapproval|human|judgment|decide|review\b/.test(text)) return "human_judgment";
  if (/\bexecute|sandbox|patch|apply|mutation|autonomous\b/.test(text)) return "execution_maturity";
  if (/\bprecedence|instruction|policy|content\b/.test(text)) return "content_precedence";
  if (/\bcommand contract|cli|usage\b/.test(text)) return "command_contract";
  return "proof_boundary";
}

function inferProofBoundary(input: HoldoutFreshnessCase): string {
  if (input.proofBoundary?.trim()) return normalizeText(input.proofBoundary);
  const text = `${input.task} ${input.localEvidence}`.toLowerCase();
  if (/\bscreenshot|rendered|visual|layout|text fit|checkmark\b/.test(text)) return "rendered_visual_artifact";
  if (/\bcommand output|exit code|npm test|typecheck|build\b/.test(text)) return "scoped_command_output";
  if (/\bdeploy|release|production|hosting\b/.test(text)) return "deployment_evidence";
  if (/\bhuman|approval|review|decision\b/.test(text)) return "human_approval";
  if (/\bstrategy|experiment|assumption\b/.test(text)) return "reasoned_strategy";
  return "local_source_evidence";
}

function hasLocalEvidence(value: string | undefined): boolean {
  return /\b(package\.json|src\/|tests\/|docs\/|scripts\/|projects\/|repo-script:|command-evidence|workspace|README|diff --git)\b/i.test(value ?? "");
}

function taskSimilarity(left: string, right: string): number {
  const a = new Set(tokens(left));
  const b = new Set(tokens(right));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((item) => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function tokens(value: string): string[] {
  return normalizeText(value)
    .replace(/\b(verification|evidence|proof)\b/g, "proof")
    .replace(/\b(absent|missing|gap|needed|need)\b/g, "gap")
    .split(/\s+/)
    .filter((item) => item.length > 2 && !["the", "and", "for", "with", "this", "that", "what"].includes(item));
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sameText(left: string | undefined, right: string | undefined): boolean {
  return normalizeText(left) === normalizeText(right) && Boolean(normalizeText(left));
}

function isRenamedKnownGap(task: string): boolean {
  const normalized = normalizeText(task);
  return /\b(biggest risk|proof gap|fake codex report|proof missing|evidence absent|verification gap)\b/.test(normalized);
}
