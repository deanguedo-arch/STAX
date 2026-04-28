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
  if (/\bdeploy|release|environment|pages|hosting\b/.test(text)) return "deployment_boundary";
  if (/\bbaseline|external|drift|capture\b/.test(text)) return "baseline_drift";
  if (/\bstrategy|roadmap|product|creative|business\b/.test(text)) return "strategy";
  if (/\bapproval|human|judgment|decide|review\b/.test(text)) return "human_judgment";
  if (/\bexecute|sandbox|patch|apply|mutation|autonomous\b/.test(text)) return "execution_maturity";
  if (/\bprecedence|instruction|policy|content\b/.test(text)) return "content_precedence";
  if (/\bcommand contract|cli|usage\b/.test(text)) return "command_contract";
  if (/\bruntime|test|build|command output|exit code|script\b/.test(text)) return "runtime_evidence";
  return "proof_boundary";
}

function inferProofBoundary(input: HoldoutFreshnessCase): string {
  if (input.proofBoundary?.trim()) return normalizeText(input.proofBoundary);
  const taskText = input.task.toLowerCase();
  if (/\bbug belongs to classic\b|\bdetermine whether a bug belongs to classic\b/.test(taskText)) return "mode_boundary";
  if (/\bduplicate game-engine\b|\bfrontend duplication\b|\bfork duplicate\b/.test(taskText)) return "shared_engine_duplication";
  if (/\bwhat does exports:fixtures prove\b|\brendered exported course\b/.test(taskText)) return "export_fixture_vs_render";
  if (/\bexport parity failure\b.*\brelease-gate failure\b/.test(taskText)) return "release_vs_export_gate";
  if (/\bwhat does npm run build:pages prove\b/.test(taskText)) return "static_pages_build_boundary";
  if (/\bonly script is build:pages\b|\bno npm test script\b/.test(taskText)) return "missing_test_entrypoint";
  const text = `${input.task} ${input.localEvidence}`.toLowerCase();
  if (/\bdocx\b.*\bpdf\b|\bpdf\b.*\bdocx\b/.test(text)) return "docx_pdf_parser_split";
  if (/\bocr\b/.test(text)) return "ocr_structured_recovery";
  if (/\bfixture drift|benchmark drift|parity|scoreboard|baseline update|baselines? change\b/.test(text)) return "benchmark_drift_control";
  if (/\bexports:fixtures|rendered exported course|exports:render\b/.test(text)) return "export_fixture_vs_render";
  if (/\bscorm|apps script|google-hosted|brightspace export|export surface|exports?:/.test(text)) return "export_surface_contract";
  if (/\bcourse shell|full e2e|e2e\b/.test(text)) return "course_shell_vs_full_e2e";
  if (/\bmetadata|manifest|generation-context|migrate:projects\b/.test(text)) return "metadata_policy_review";
  if (/\bassessment import|assessment export|assessment-delivery\b/.test(text)) return "assessment_import_export";
  if (/\bsave\/load|save load|saves layer\b/.test(text)) return "save_load_contract";
  if (/\bsimulation|balance|simulate_runs|content\/balance\b/.test(text)) return "deterministic_simulation";
  if (/\bduplicate game-engine|authoritative simulation|frontend duplication\b/.test(text)) return "shared_engine_duplication";
  if (/\bclassic|desktop|shared simulation|mode architecture|mode-aware|content loading\b/.test(text)) return "mode_boundary";
  if (/\bconversion|convert|validation|cf:validate|cf:convert\b/.test(text)) return "conversion_vs_validation";
  if (/\bcf:doctor|doctor\b/.test(text)) return "doctor_preflight_boundary";
  if (/\bcomposer|drag|resize|canvas\b/.test(text)) return "composer_ui_visual_boundary";
  if (/\bwhat does npm run build:pages prove|build pages contract|build:pages prove\b/.test(text)) return "static_pages_build_boundary";
  if (/\bno npm test|no test script|build:pages\b/.test(text)) return "missing_test_entrypoint";
  if (/\bingest:ci|promotion gate|canonical promotion|diagnostic\b/.test(text)) return "command_promotion_contract";
  if (/\bteacher correction|correction|candidate snapshots?|promote-corrections\b/.test(text)) return "correction_promotion_boundary";
  if (/\boverfit|fixture language|benchmark.*usefulness\b/.test(text)) return "benchmark_overfit_control";
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
