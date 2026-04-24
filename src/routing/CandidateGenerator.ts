import type { CompleteRequest, ModelProvider } from "../providers/ModelProvider.js";

export type CandidateOutput = {
  id: string;
  text: string;
  provider: string;
  model: string;
  temperature: number;
  score?: number;
};

export class CandidateGenerator {
  async generate(provider: ModelProvider, request: CompleteRequest): Promise<CandidateOutput[]> {
    const response = await provider.complete(request);
    return [
      {
        id: "candidate-1",
        text: response.text,
        provider: provider.name,
        model: provider.model,
        temperature: request.temperature ?? 0.2
      }
    ];
  }
}
