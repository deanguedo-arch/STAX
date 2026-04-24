import type {
  CompleteRequest,
  CompleteResponse,
  ModelProvider
} from "./ModelProvider.js";

export class MockProvider implements ModelProvider {
  name = "mock";
  model = "mock-model";
  calls: CompleteRequest[] = [];

  async complete(request: CompleteRequest): Promise<CompleteResponse> {
    this.calls.push(request);

    const last = request.messages.at(-1)?.content ?? "";
    const seed = request.seed ?? 1;

    return {
      text: [
        "[MOCK RESPONSE]",
        `seed=${seed}`,
        "",
        "Input:",
        last.slice(0, 1000)
      ].join("\n"),
      usage: {
        totalTokens: Math.ceil(last.length / 4)
      }
    };
  }
}
