import type { ValidatedEvent } from "../types/index.js";
import type {
  KernelLedgerEvent,
  KernelLedgerRecord,
  KernelValidationDecision,
  ProcessCandidateResult
} from "./types.js";

const kernelTruthBrand: unique symbol = Symbol("staxcore.kernel.truth");
const issuedKernelTruth = new WeakSet<object>();

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function validationFromDecision(decision: KernelValidationDecision): ValidatedEvent {
  return decision.outcome === "rejected" ? decision.rejection : decision.event;
}

export interface KernelTruth {
  readonly [kernelTruthBrand]: true;
  readonly decision: KernelValidationDecision;
  readonly validation: ValidatedEvent;
  readonly ledgerRecord: KernelLedgerRecord<KernelLedgerEvent>;
  readonly ledgerValid: boolean;
}

export interface KernelTruthView {
  decision: KernelValidationDecision;
  validation: ValidatedEvent;
  ledgerRecord: KernelLedgerRecord<KernelLedgerEvent>;
  ledgerValid: boolean;
}

export function sealKernelTruth(result: ProcessCandidateResult): KernelTruth {
  const truth = deepFreeze({
    [kernelTruthBrand]: true as const,
    decision: cloneJson(result.decision),
    validation: cloneJson(validationFromDecision(result.decision)),
    ledgerRecord: cloneJson(result.ledgerRecord),
    ledgerValid: result.ledgerValid
  });
  issuedKernelTruth.add(truth);
  return truth;
}

export function assertKernelTruth(value: unknown): asserts value is KernelTruth {
  if (
    !value ||
    typeof value !== "object" ||
    (value as Partial<KernelTruth>)[kernelTruthBrand] !== true ||
    !issuedKernelTruth.has(value)
  ) {
    throw new Error("BOUNDARY_VIOLATION: value is not sealed kernel truth.");
  }
}

export function readKernelTruth(truth: KernelTruth): KernelTruthView {
  assertKernelTruth(truth);
  return cloneJson({
    decision: truth.decision,
    validation: truth.validation,
    ledgerRecord: truth.ledgerRecord,
    ledgerValid: truth.ledgerValid
  });
}
