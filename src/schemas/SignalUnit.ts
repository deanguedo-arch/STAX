export type SignalUnit = {
  id: string;
  type: string;
  source: string;
  timestamp?: string;
  rawInput: string;
  observedFact: string;
  inference?: string;
  confidence: "low" | "medium" | "high";
};

export type StaxFitnessOutput = {
  signalUnits: SignalUnit[];
  timeline: string[];
  patternCandidates: string[];
  deviations: string[];
  unknowns: string[];
  confidenceSummary: "low" | "medium" | "high";
};
