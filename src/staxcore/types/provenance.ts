export type SourceType =
  | "measurement"
  | "finding"
  | "decision"
  | "narrative"
  | "recommendation"
  | "opinion"
  | "ai_extraction"
  | "unknown";

export interface Provenance {
  sourceId: string;
  sourceType: SourceType;
  receivedAt: string;
  capturedBy: string;
  trustLevel: number;
  rawReference: string;
  occurredAt?: string;
}
