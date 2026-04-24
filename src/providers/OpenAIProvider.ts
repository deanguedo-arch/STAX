import OpenAI from "openai";
import type {
  CompleteRequest,
  CompleteResponse,
  ModelProvider
} from "./ModelProvider.js";

export class OpenAIProvider implements ModelProvider {
  name = "openai";
  private client: OpenAI;

  constructor(
    apiKey: string,
    public model: string
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async complete(request: CompleteRequest): Promise<CompleteResponse> {
    const input = [
      ...(request.system
        ? [{ role: "system" as const, content: request.system }]
        : []),
      ...request.messages.map((message) => ({
        role:
          message.role === "tool"
            ? ("user" as const)
            : (message.role as "user" | "assistant" | "system" | "developer"),
        content: message.content
      }))
    ];

    const response = await this.client.responses.create({
      model: this.model,
      input,
      temperature: request.temperature,
      top_p: request.top_p,
      max_output_tokens: request.maxTokens
    } as never);

    return {
      text: response.output_text ?? "",
      raw: response
    };
  }
}
