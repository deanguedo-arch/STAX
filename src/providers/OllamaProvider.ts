import type {
  CompleteRequest,
  CompleteResponse,
  ModelProvider
} from "./ModelProvider.js";

export class OllamaProvider implements ModelProvider {
  name = "ollama";

  constructor(
    private baseUrl: string,
    public model: string
  ) {}

  async complete(request: CompleteRequest): Promise<CompleteResponse> {
    const prompt = request.messages
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join("\n\n");

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      request.timeoutMs ?? 10000
    );

    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          system: request.system,
          prompt,
          stream: false,
          options: {
            temperature: request.temperature ?? 0.2,
            top_p: request.top_p ?? 1,
            seed: request.seed
          }
        })
      });

      if (!res.ok) {
        throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as {
        response?: string;
        eval_count?: number;
        prompt_eval_count?: number;
      };

      return {
        text: data.response ?? "",
        raw: data,
        usage: {
          totalTokens: (data.eval_count ?? 0) + (data.prompt_eval_count ?? 0)
        }
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
