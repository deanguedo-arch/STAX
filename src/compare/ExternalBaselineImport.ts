import crypto from "node:crypto";
import {
  ExternalBaselineImportInputSchema,
  ExternalBaselineImportResultSchema,
  type ExternalBaselineImportInput,
  type ExternalBaselineImportResult
} from "./ExternalBaselineSchemas.js";

export class ExternalBaselineImport {
  validate(input: ExternalBaselineImportInput | unknown): ExternalBaselineImportResult {
    const parsed = ExternalBaselineImportInputSchema.parse(input);
    const blockingReasons: string[] = [];
    const warnings: string[] = [];

    if (!parsed.externalAnswerSource?.trim()) blockingReasons.push("External answer source is missing.");
    if (!parsed.externalCapturedAt?.trim()) {
      blockingReasons.push("External answer capture time is missing.");
    } else if (!isIsoDate(parsed.externalCapturedAt)) {
      blockingReasons.push("External answer capture time must be an ISO timestamp.");
    }
    if (!parsed.externalPrompt?.trim()) blockingReasons.push("External prompt is missing.");
    if (!parsed.captureContext?.trim()) warnings.push("Capture context is missing; this baseline can support a slice but not source/context diversity.");
    if (parsed.humanConfirmedNotDrifted !== true) blockingReasons.push("Human drift confirmation is missing or false.");

    if (isGeneric(parsed.externalAnswer)) {
      blockingReasons.push("External answer is generic and cannot be used as a comparison baseline.");
    }
    if (parsed.task && ignoresTask(parsed.task, parsed.externalAnswer)) {
      blockingReasons.push("External answer does not address the supplied task.");
    }
    if (talksAboutStaxArchitectureInsteadOfTask(parsed.externalAnswer, parsed.task)) {
      blockingReasons.push("External answer talks about STAX architecture instead of the repo/task baseline.");
    }
    if (parsed.staxAnswer && similarity(parsed.staxAnswer, parsed.externalAnswer) >= 0.82) {
      blockingReasons.push("External answer appears copied from the STAX answer.");
    }

    return ExternalBaselineImportResultSchema.parse({
      caseId: parsed.caseId,
      externalBaselineValid: blockingReasons.length === 0,
      metadataValid: !blockingReasons.some((item) => /source|capture time|prompt|drift/i.test(item)),
      contentValid: !blockingReasons.some((item) => /generic|does not address|architecture|copied/i.test(item)),
      blockingReasons,
      warnings,
      normalized: {
        externalAnswerSource: parsed.externalAnswerSource?.trim(),
        externalCapturedAt: parsed.externalCapturedAt?.trim(),
        externalPrompt: parsed.externalPrompt?.trim(),
        captureContext: parsed.captureContext?.trim(),
        answerHash: hashText(parsed.externalAnswer)
      }
    });
  }

  format(result: ExternalBaselineImportResult): string {
    return [
      "## External Baseline Import",
      `Case: ${result.caseId}`,
      `Valid: ${result.externalBaselineValid}`,
      `MetadataValid: ${result.metadataValid}`,
      `ContentValid: ${result.contentValid}`,
      `AnswerHash: ${result.normalized.answerHash}`,
      "",
      "## Blocking Reasons",
      result.blockingReasons.length ? result.blockingReasons.map((item) => `- ${item}`).join("\n") : "- None",
      "",
      "## Warnings",
      result.warnings.length ? result.warnings.map((item) => `- ${item}`).join("\n") : "- None"
    ].join("\n");
  }
}

function isIsoDate(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && /^\d{4}-\d{2}-\d{2}T/.test(value);
}

function isGeneric(answer: string): boolean {
  const normalized = answer.toLowerCase();
  return answer.trim().length < 80 ||
    /\b(review the repo|improve the code|fix the issue|add tests|use best practices|more robust)\b/i.test(normalized);
}

function ignoresTask(task: string, answer: string): boolean {
  const taskTerms = importantTerms(task);
  if (taskTerms.length < 3) return false;
  const matched = taskTerms.filter((term) => answer.toLowerCase().includes(term)).length;
  return matched / taskTerms.length < 0.18;
}

function talksAboutStaxArchitectureInsteadOfTask(answer: string, task: string | undefined): boolean {
  if (!task || /\bstax|rax|superiority|benchmark\b/i.test(task)) return false;
  return /\b(stax|rax|superiority gate|local assistant runtime|governed runtime)\b/i.test(answer);
}

function importantTerms(value: string): string[] {
  return Array.from(new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)
    .filter((item) => item.length > 4 && !["should", "would", "about", "which", "there", "their"].includes(item))));
}

function similarity(left: string, right: string): number {
  const a = new Set(importantTerms(left));
  const b = new Set(importantTerms(right));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((item) => b.has(item)).length;
  return intersection / new Set([...a, ...b]).size;
}

function hashText(value: string): string {
  return crypto.createHash("sha256").update(value.trim()).digest("hex");
}
