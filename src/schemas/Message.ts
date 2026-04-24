export type Role =
  | "system"
  | "developer"
  | "user"
  | "assistant"
  | "tool";

export type Message = {
  role: Role;
  content: string;
  name?: string;
};
