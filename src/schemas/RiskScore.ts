export type RiskScore = {
  intent: number;
  harm: number;
  actionability: number;
  privacy: number;
  exploitation: number;
  regulatedAdvice: number;
  systemIntegrity: number;
  total: number;
  labels: string[];
};
