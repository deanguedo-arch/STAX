import {
  BaselineDateGateInputSchema,
  BaselineDateGateResultSchema,
  type BaselineDateGateInput,
  type BaselineDateGateResult
} from "./BaselineDateSchemas.js";

export class BaselineDateGate {
  evaluate(input: BaselineDateGateInput): BaselineDateGateResult {
    const parsed = BaselineDateGateInputSchema.parse(input);
    const blockingReasons: string[] = [];
    const warnings: string[] = [];
    const ignoredDuplicates: string[] = [];
    const dates = new Set<string>();
    const seenCaptureKeys = new Set<string>();
    const now = parsed.now ? new Date(parsed.now) : new Date();

    for (const record of parsed.records) {
      if (!record.externalCapturedAt) {
        blockingReasons.push(`${record.caseId} is missing externalCapturedAt.`);
        continue;
      }
      const captured = new Date(record.externalCapturedAt);
      if (!Number.isFinite(captured.getTime()) || !/^\d{4}-\d{2}-\d{2}T/.test(record.externalCapturedAt)) {
        blockingReasons.push(`${record.caseId} has an invalid externalCapturedAt timestamp.`);
        continue;
      }
      if (captured.getTime() > now.getTime() + 60_000) {
        blockingReasons.push(`${record.caseId} has a future externalCapturedAt timestamp.`);
        continue;
      }
      const duplicateKey = [
        record.externalAnswerSource ?? "",
        record.captureContext ?? "",
        record.promptHash ?? "",
        record.externalAnswerHash ?? ""
      ].join("|");
      if (record.duplicated || (record.externalAnswerHash && seenCaptureKeys.has(duplicateKey))) {
        ignoredDuplicates.push(record.caseId);
        continue;
      }
      seenCaptureKeys.add(duplicateKey);
      dates.add(record.externalCapturedAt.slice(0, 10));
      if (now.getTime() - captured.getTime() > parsed.staleAfterDays * 24 * 60 * 60 * 1000) {
        warnings.push(`${record.caseId} baseline is stale relative to ${parsed.staleAfterDays} day window.`);
      }
    }

    const captureDates = Array.from(dates).sort();
    if (captureDates.length < parsed.minUniqueDates) {
      blockingReasons.push(`Need external baselines captured on at least ${parsed.minUniqueDates} dates; current ${captureDates.length}.`);
    }

    return BaselineDateGateResultSchema.parse({
      captureDates,
      uniqueDateCount: captureDates.length,
      status: captureDates.length >= parsed.minUniqueDates && blockingReasons.length === 0 ? "multi_day_eligible" : "one_day_slice",
      blockingReasons,
      warnings,
      ignoredDuplicates
    });
  }
}
