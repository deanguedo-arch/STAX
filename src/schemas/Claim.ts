export type Claim = {
  id: string;
  text: string;
  source:
    | "user_input"
    | "retrieved_memory"
    | "retrieved_example"
    | "retrieved_file"
    | "model_inference";
  confidence: "low" | "medium" | "high";
  evidence?: string;
};
