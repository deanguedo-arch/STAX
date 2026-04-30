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
