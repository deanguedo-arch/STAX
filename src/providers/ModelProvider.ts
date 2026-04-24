import type { Message } from "../schemas/Message.js";

export type CompleteRequest = {
  system?: string;
  messages: Message[];
  temperature?: number;
  top_p?: number;
  seed?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

export type CompleteResponse = {
  text: string;
  raw?: unknown;
  usage?: {
    totalTokens?: number;
  };
};

export interface ModelProvider {
  name: string;
  model: string;
  complete(request: CompleteRequest): Promise<CompleteResponse>;
}
