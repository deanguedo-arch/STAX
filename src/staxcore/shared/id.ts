import { createHash, randomUUID } from "node:crypto";

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

function canonicalize(value: unknown, seen = new WeakSet<object>()): CanonicalValue {
  if (value === null) return null;
  if (value === undefined) return { "$undefined": true };
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : { "$number": String(value) };
  }
  if (typeof value === "bigint") return { "$bigint": value.toString() };
  if (typeof value === "symbol") return { "$symbol": value.description ?? "" };
  if (typeof value === "function") return { "$function": value.name || "anonymous" };
  if (value instanceof Date) return { "$date": value.toISOString() };
  if (Array.isArray(value)) return value.map((item) => canonicalize(item, seen));
  if (typeof value === "object") {
    if (seen.has(value)) throw new Error("Cannot hash circular values.");
    seen.add(value);
    const output: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = canonicalize((value as Record<string, unknown>)[key], seen);
    }
    seen.delete(value);
    return output;
  }
  return { "$unknown": String(value) };
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function stableHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
