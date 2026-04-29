import type { Tool, ToolResult } from "./Tool.js";
import { defaultCapabilityRegistry } from "../capabilities/CapabilityRegistry.js";

export class GitTool implements Tool {
  name = "git";
  capabilityId = "git.mutate";
  enabled = false;

  async run(_input: string): Promise<ToolResult> {
    const capability = defaultCapabilityRegistry().decide({
      capabilityId: this.capabilityId,
      context: "durable_state",
      approved: false
    });
    return {
      ok: false,
      output: `Git tool requires explicit approval and does not auto-commit, push, or mutate state in v0.1. ${capability.reason}`
    };
  }
}
