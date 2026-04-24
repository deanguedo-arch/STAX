export type MemoryType =
  | "session"
  | "project"
  | "user_preference"
  | "correction"
  | "golden"
  | "example"
  | "forbidden";

export type MemoryRecord = {
  id: string;
  type: MemoryType;
  scope?: "session" | "project";
  content: string;
  text: string;
  sourceRunId?: string;
  createdAt: string;
  expiresAt?: string;
  confidence: "low" | "medium" | "high";
  approved: boolean;
  tags: string[];
};
