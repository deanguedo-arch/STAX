import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ensureDirectory, readTextIfExists, sidecarDir, validateRepoPath } from "./SidecarRepo.js";

export type CodexTurnMessage = {
  role: string;
  text: string;
};

export type CodexTurnCapture = {
  schemaVersion: "stax-codex-turn-v1";
  capturedAt: string;
  sessionId: string;
  source: {
    path: string;
    hash: string;
    modifiedAt: string;
  };
  messageCount: number;
  messages: CodexTurnMessage[];
};

export type CollectCodexTurnOptions = {
  repoPath: string;
  sessionsRoot?: string;
  sourceFile?: string;
  now?: Date;
};

export type CollectCodexTurnResult = {
  currentTurnPath: string;
  turnArtifactPath: string;
  sessionId: string;
  messageCount: number;
};

export type WriteSidecarHeartbeatOptions = {
  repoPath: string;
  now?: Date;
  pid?: number;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function nowIso(now = new Date()): string {
  return now.toISOString();
}

function safeSegment(value: string): string {
  return normalizeText(value).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function artifactNameFromIso(value: string): string {
  return value.replace(/[:.]/g, "-");
}

function defaultSessionsRoot(): string {
  const codexHome = normalizeText(process.env.CODEX_HOME);
  return codexHome ? path.resolve(codexHome, "sessions") : path.resolve(os.homedir(), ".codex", "sessions");
}

function sha256Buffer(input: Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listJsonlFiles(root: string): Promise<string[]> {
  if (!(await pathExists(root))) return [];
  const output: string[] = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop()!;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".jsonl")) {
        output.push(entryPath);
      }
    }
  }
  return output;
}

async function newestJsonlFile(root: string): Promise<string | undefined> {
  const files = await listJsonlFiles(root);
  const withStats = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      modifiedAt: (await fs.stat(filePath)).mtimeMs
    }))
  );
  return withStats.sort((left, right) => right.modifiedAt - left.modifiedAt)[0]?.filePath;
}

async function resolveSourceFile(options: CollectCodexTurnOptions): Promise<string> {
  if (options.sourceFile) {
    const resolved = path.resolve(options.sourceFile);
    if (!(await pathExists(resolved))) throw new Error(`Codex session source file does not exist: ${resolved}`);
    return resolved;
  }

  const sessionsRoot = path.resolve(options.sessionsRoot ?? defaultSessionsRoot());
  const sourceFile = await newestJsonlFile(sessionsRoot);
  if (!sourceFile) throw new Error(`No Codex session .jsonl files found under: ${sessionsRoot}`);
  return sourceFile;
}

function parseJsonLine(line: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(line) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function payloadForEvent(event: Record<string, unknown>): Record<string, unknown> {
  return objectValue(event.payload) ?? objectValue(event.item) ?? event;
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return normalizeText(content);
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      const object = objectValue(part);
      return object ? object.text ?? object.input_text ?? object.output_text ?? "" : "";
    })
    .map(normalizeText)
    .filter(Boolean)
    .join("\n")
    .trim();
}

function sessionIdFromEvents(events: Record<string, unknown>[], sourceFile: string): string {
  for (const event of events) {
    if (event.type !== "session_meta") continue;
    const payload = objectValue(event.payload);
    const id = normalizeText(payload?.id ?? payload?.sessionId ?? event.sessionId);
    if (id) return id;
  }
  return path.basename(sourceFile, path.extname(sourceFile));
}

function messagesFromEvents(events: Record<string, unknown>[]): CodexTurnMessage[] {
  const messages: CodexTurnMessage[] = [];
  for (const event of events) {
    const payload = payloadForEvent(event);
    if (payload.type !== "message") continue;
    const role = normalizeText(payload.role);
    const text = textFromContent(payload.content);
    if (role && text) messages.push({ role, text });
  }
  return messages;
}

export async function collectCodexTurn(options: CollectCodexTurnOptions): Promise<CollectCodexTurnResult> {
  const repoPath = await validateRepoPath(options.repoPath);
  const staxPath = sidecarDir(repoPath);
  const sourceFile = await resolveSourceFile(options);
  const sourceContent = await fs.readFile(sourceFile);
  const sourceStats = await fs.stat(sourceFile);
  const events = sourceContent
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseJsonLine)
    .filter((event): event is Record<string, unknown> => Boolean(event));
  const capturedAt = nowIso(options.now);
  const sessionId = sessionIdFromEvents(events, sourceFile);
  const messages = messagesFromEvents(events);
  const capture: CodexTurnCapture = {
    schemaVersion: "stax-codex-turn-v1",
    capturedAt,
    sessionId,
    source: {
      path: sourceFile,
      hash: sha256Buffer(sourceContent),
      modifiedAt: new Date(sourceStats.mtimeMs).toISOString()
    },
    messageCount: messages.length,
    messages
  };
  const currentTurnPath = path.join(staxPath, "current-turn.json");
  const turnDir = path.join(staxPath, "turns", safeSegment(sessionId));
  const turnArtifactPath = path.join(turnDir, `${artifactNameFromIso(capturedAt)}.json`);

  await ensureDirectory(turnDir);
  await fs.writeFile(currentTurnPath, `${JSON.stringify(capture, null, 2)}\n`, "utf8");
  await fs.writeFile(turnArtifactPath, `${JSON.stringify(capture, null, 2)}\n`, "utf8");

  return {
    currentTurnPath,
    turnArtifactPath,
    sessionId,
    messageCount: messages.length
  };
}

export async function writeSidecarHeartbeat(options: WriteSidecarHeartbeatOptions): Promise<string> {
  const repoPath = await validateRepoPath(options.repoPath);
  const heartbeatPath = path.join(sidecarDir(repoPath), "runtime", "heartbeat.json");
  await ensureDirectory(path.dirname(heartbeatPath));
  await fs.writeFile(
    heartbeatPath,
    `${JSON.stringify(
      {
        schemaVersion: "stax-sidecar-heartbeat-v1",
        status: "running",
        updatedAt: nowIso(options.now),
        pid: options.pid ?? process.pid
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return heartbeatPath;
}

export async function tryCollectCodexTurn(options: CollectCodexTurnOptions): Promise<CollectCodexTurnResult | undefined> {
  try {
    return await collectCodexTurn(options);
  } catch {
    return undefined;
  }
}

export async function readCurrentCodexTurn(repoPath: string): Promise<CodexTurnCapture | undefined> {
  const raw = await readTextIfExists(path.join(sidecarDir(repoPath), "current-turn.json"));
  if (!raw.trim()) return undefined;
  return JSON.parse(raw) as CodexTurnCapture;
}
