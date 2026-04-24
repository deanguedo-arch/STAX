import fs from "node:fs/promises";
import path from "node:path";
import type { AgentResult } from "../schemas/AgentResult.js";
import type { RaxConfig } from "../schemas/Config.js";
import type { RiskScore } from "../schemas/RiskScore.js";
import type { RunTrace } from "../schemas/RunLog.js";
import type { BoundaryResult } from "../safety/BoundaryDecision.js";

export type RunLoggerPayload = {
  runId: string;
  input: string;
  config: RaxConfig;
  stack: string[];
  risk: RiskScore;
  boundary: BoundaryResult;
  routing?: Record<string, unknown>;
  primary?: AgentResult;
  critic?: AgentResult;
  final: string;
  trace: RunTrace;
  createdAt: string;
};

export class RunLogger {
  constructor(private rootDir = process.cwd()) {}

  async log(payload: RunLoggerPayload): Promise<string> {
    const date = payload.createdAt.slice(0, 10);
    const dir = path.join(this.rootDir, "runs", date, payload.runId);
    await fs.mkdir(dir, { recursive: true });

    await Promise.all([
      fs.writeFile(path.join(dir, "input.txt"), payload.input, "utf8"),
      fs.writeFile(
        path.join(dir, "config.json"),
        JSON.stringify(payload.config, null, 2),
        "utf8"
      ),
      fs.writeFile(path.join(dir, "stack.md"), payload.stack.join("\n\n"), "utf8"),
      fs.writeFile(
        path.join(dir, "risk.json"),
        JSON.stringify(payload.risk, null, 2),
        "utf8"
      ),
      fs.writeFile(
        path.join(dir, "routing.json"),
        JSON.stringify(payload.routing ?? {}, null, 2),
        "utf8"
      ),
      fs.writeFile(
        path.join(dir, "agent-output.md"),
        payload.primary?.output ?? "",
        "utf8"
      ),
      fs.writeFile(path.join(dir, "critic.md"), payload.critic?.output ?? "", "utf8"),
      fs.writeFile(path.join(dir, "final.md"), payload.final, "utf8"),
      fs.writeFile(
        path.join(dir, "trace.json"),
        JSON.stringify(payload.trace, null, 2),
        "utf8"
      )
    ]);

    return dir;
  }
}
