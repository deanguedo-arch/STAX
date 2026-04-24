export type ToolResult = {
  ok: boolean;
  output: string;
};

export interface Tool {
  name: string;
  enabled: boolean;
  run(input: string): Promise<ToolResult>;
}
