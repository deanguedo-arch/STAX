import crypto from "node:crypto";
import {
  ExternalSourceDiversityGateInputSchema,
  ExternalSourceDiversityGateResultSchema,
  type ExternalSourceDiversityGateInput,
  type ExternalSourceDiversityGateResult,
  type ExternalSourceRecord,
  type ExternalSourceType
} from "./ExternalSourceDiversitySchemas.js";

export class ExternalSourceDiversityGate {
  evaluate(input: ExternalSourceDiversityGateInput): ExternalSourceDiversityGateResult {
    const parsed = ExternalSourceDiversityGateInputSchema.parse(input);
    const blockingReasons: string[] = [];
    const duplicateSources: string[] = [];
    const seenSources = new Set<string>();
    const contexts = new Set<string>();
    const normalized = parsed.sources.map((source, index) => {
      const caseId = source.caseId ?? `source_${index + 1}`;
      if (!source.sourceId?.trim()) blockingReasons.push(`${caseId} is missing sourceId metadata.`);
      const sourceType = source.sourceType ?? inferSourceType(source.sourceId);
      const canonicalSourceKey = canonicalKey(sourceType, source.sourceId);
      const contextKey = `${canonicalSourceKey}|${source.captureContext ?? ""}|${source.promptHash ?? ""}`;
      const duplicate = seenSources.has(canonicalSourceKey);
      if (duplicate) duplicateSources.push(caseId);
      if (source.captureContext || source.promptHash) contexts.add(contextKey);
      const countsAsNewSource = Boolean(source.countsAsNewSource && !duplicate && source.sourceId?.trim());
      if (countsAsNewSource) seenSources.add(canonicalSourceKey);
      return {
        ...source,
        caseId,
        sourceType,
        canonicalSourceKey,
        countsAsNewSource
      };
    });

    if (seenSources.size < parsed.minUniqueSources) {
      blockingReasons.push(`Need at least ${parsed.minUniqueSources} distinct external sources; current ${seenSources.size}.`);
    }

    return ExternalSourceDiversityGateResultSchema.parse({
      uniqueSourceCount: seenSources.size,
      uniqueContextCount: contexts.size,
      status: seenSources.size >= parsed.minUniqueSources && blockingReasons.length === 0
        ? "source_diverse_eligible"
        : "single_source_slice",
      blockingReasons,
      duplicateSources,
      sources: normalized
    });
  }
}

export function promptHash(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  return crypto.createHash("sha256").update(value.trim()).digest("hex").slice(0, 16);
}

function canonicalKey(sourceType: ExternalSourceType, sourceId: string | undefined): string {
  const normalized = (sourceId ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${sourceType}:${normalized}`;
}

function inferSourceType(sourceId: string | undefined): ExternalSourceType {
  if (/\bcodex\b/i.test(sourceId ?? "")) return "codex-report";
  if (/\bhuman\b/i.test(sourceId ?? "")) return "manual-human-baseline";
  if (/\bclaude|gemini|gpt|other-model\b/i.test(sourceId ?? "")) return "other-model";
  return "browser-chat";
}
