import type { Tool, ToolResult } from "./Tool.js";

export class GitTool implements Tool {
  name = "git";
  enabled = false;

  async run(_input: string): Promise<ToolResult> {
    return {
      ok: false,
      output: "Git tool requires explicit approval and does not auto-commit, push, or mutate state in v0.1."
    };
  }
}
