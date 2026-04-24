export type MemoryRecord = {
  id: string;
  scope: "session" | "project";
  text: string;
  tags: string[];
  createdAt: string;
};
