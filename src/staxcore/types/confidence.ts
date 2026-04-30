export interface ConfidenceVector {
  completeness: number;
  consistency: number;
  sourceStrength: number;
  evidenceDensity: number;
  conflictPenalty: number;
  recency: number;
  traceability: number;
}

export interface ConfidenceResult {
  score: number;
  vector: ConfidenceVector;
  caps: string[];
  explanation: string;
  sourceWeight: number;
}
