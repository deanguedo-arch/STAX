export type SignalType =
  | "trend"
  | "anomaly"
  | "conflict"
  | "recurrence"
  | "volatility"
  | "missingData"
  | "sourceShift";

export interface Signal {
  id: string;
  type: SignalType;
  description: string;
  sourceValidationIds: string[];
  provisional: boolean;
}

export interface SignalObservation {
  validationId: string;
  state: "VALIDATED" | "CONFLICTED" | "REJECTED" | "SUPERSEDED";
  claim: string;
  sourceId: string;
  sourceType: string;
  warnings: string[];
}

export interface SignalPattern {
  id: string;
  description: string;
  sourceValidationIds: string[];
  provisional: boolean;
}

export interface SignalGap {
  id: string;
  description: string;
  sourceValidationIds: string[];
}

export interface SignalRisk {
  id: string;
  description: string;
  sourceValidationIds: string[];
  severity: "low" | "medium" | "high";
}

export interface SignalTrend {
  id: string;
  description: string;
  sourceValidationIds: string[];
  direction: "improving" | "declining" | "stable" | "unknown";
  provisional: boolean;
}

export interface RecommendationPolicy {
  allowed: boolean;
  withheld: boolean;
  reason: string;
}

export interface SignalPacketConfidence {
  score: number;
  rationale: string;
  caps: string[];
}

export interface SignalPacket {
  observations: SignalObservation[];
  patterns: SignalPattern[];
  gaps: SignalGap[];
  risks: SignalRisk[];
  trends: SignalTrend[];
  recommendationPolicy: RecommendationPolicy;
  confidence: SignalPacketConfidence;
}
