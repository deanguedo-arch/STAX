import fs from "node:fs/promises";
import path from "node:path";
import type { RaxMode } from "../schemas/Config.js";

export type ChatMode = RaxMode | "auto";
export type ChatMessageRole = "user" | "assistant" | "system";

export type ChatMessage = {
  messageId: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
  runId?: string;
  learningEventId?: string;
};

export type ChatThread = {
  threadId: string;
  workspace: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  mode: ChatMode;
  messages: ChatMessage[];
  linkedRuns: string[];
  linkedLearningEvents: string[];
};

export class ThreadStore {
  constructor(private rootDir = process.cwd()) {}

  async getOrCreate(threadId = "thread_default"): Promise<ChatThread> {
    const existing = await this.read(threadId);
    if (existing) return existing;
    return this.create({ threadId, title: "STAX Chat", workspace: "default", mode: "auto" });
  }

  async create(input: { threadId?: string; title?: string; workspace?: string; mode?: ChatMode } = {}): Promise<ChatThread> {
    const now = new Date().toISOString();
    const thread: ChatThread = {
      threadId: input.threadId ?? this.createId("thread"),
      workspace: input.workspace ?? "default",
      title: input.title ?? "New Chat",
      createdAt: now,
      updatedAt: now,
      mode: input.mode ?? "auto",
      messages: [],
      linkedRuns: [],
      linkedLearningEvents: []
    };
    await this.write(thread);
    return thread;
  }

  async read(threadId: string): Promise<ChatThread | undefined> {
    try {
      return JSON.parse(await fs.readFile(this.threadPath(threadId), "utf8")) as ChatThread;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async appendMessage(threadId: string, message: Omit<ChatMessage, "messageId" | "createdAt">): Promise<ChatThread> {
    const thread = await this.getOrCreate(threadId);
    const nextMessage: ChatMessage = {
      messageId: this.createId("msg"),
      createdAt: new Date().toISOString(),
      ...message
    };
    const linkedRuns = message.runId ? Array.from(new Set([...thread.linkedRuns, message.runId])) : thread.linkedRuns;
    const linkedLearningEvents = message.learningEventId
      ? Array.from(new Set([...thread.linkedLearningEvents, message.learningEventId]))
      : thread.linkedLearningEvents;
    const updated = {
      ...thread,
      updatedAt: new Date().toISOString(),
      messages: [...thread.messages, nextMessage],
      linkedRuns,
      linkedLearningEvents
    };
    await this.write(updated);
    return updated;
  }

  async updateMode(threadId: string, mode: ChatMode): Promise<ChatThread> {
    const thread = await this.getOrCreate(threadId);
    const updated = { ...thread, mode, updatedAt: new Date().toISOString() };
    await this.write(updated);
    return updated;
  }

  async updateWorkspace(threadId: string, workspace: string): Promise<ChatThread> {
    const thread = await this.getOrCreate(threadId);
    const updated = { ...thread, workspace, updatedAt: new Date().toISOString() };
    await this.write(updated);
    return updated;
  }

  private async write(thread: ChatThread): Promise<void> {
    await fs.mkdir(path.join(this.rootDir, "chats", "threads"), { recursive: true });
    const target = this.threadPath(thread.threadId);
    const temp = `${target}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    await fs.writeFile(temp, JSON.stringify(thread, null, 2), "utf8");
    await fs.rename(temp, target);
  }

  private threadPath(threadId: string): string {
    return path.join(this.rootDir, "chats", "threads", `${threadId}.json`);
  }

  private createId(prefix: string): string {
    return `${prefix}_${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 17)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }
}
