import fs from "node:fs/promises";
import path from "node:path";
import type { AgentResult } from "../schemas/AgentResult.js";
import type { RaxConfig } from "../schemas/Config.js";
import type { ModeDetection } from "../classifiers/ModeDetector.js";
import type { PolicyBundle } from "../policy/policyTypes.js";
import type { RiskScore } from "../schemas/RiskScore.js";
import type { RunTrace } from "../schemas/RunLog.js";
import type { BoundaryResult } from "../safety/BoundaryDecision.js";
import type { CriticReview } from "../validators/CriticGate.js";
import { LearningRecorder } from "../learning/LearningRecorder.js";

export type RunLoggerPayload = {
  runId: string;
  input: string;
  config: RaxConfig;
  stack: string[];
  intent?: Record<string, unknown>;
  risk: RiskScore;
  boundary: BoundaryResult;
  mode?: ModeDetection;
  policyBundle?: PolicyBundle;
  retrievedMemory?: unknown[];
  retrievedExamples?: unknown[];
  candidateOutputs?: unknown[];
  routing?: Record<string, unknown>;
  primary?: AgentResult;
  critic?: AgentResult;
  criticReview?: CriticReview;
  repair?: string;
  formatter?: string;
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
      fs.writeFile(
        path.join(dir, "config.snapshot.json"),
        JSON.stringify(payload.config, null, 2),
        "utf8"
      ),
      fs.writeFile(
        path.join(dir, "normalized_input.json"),
        JSON.stringify({ input: payload.input.trim() }, null, 2),
        "utf8"
      ),
      fs.writeFile(
        path.join(dir, "mode.json"),
        JSON.stringify(payload.mode ?? {}, null, 2),
        "utf8"
      ),
      fs.writeFile(
        path.join(dir, "intent.json"),
        JSON.stringify(payload.intent ?? {}, null, 2),
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
        path.join(dir, "boundary.json"),
        JSON.stringify(payload.boundary, null, 2),
        "utf8"
      ),
      fs.writeFile(
        path.join(dir, "policy_bundle.md"),
        payload.policyBundle?.compiledSystemPrompt ?? "",
        "utf8"
      ),
      fs.writeFile(
        path.join(dir, "retrieved_memory.json"),
        JSON.stringify(payload.retrievedMemory ?? [], null, 2),
        "utf8"
      ),
      fs.writeFile(
        path.join(dir, "retrieved_examples.json"),
        JSON.stringify(payload.retrievedExamples ?? [], null, 2),
        "utf8"
      ),
      fs.writeFile(
        path.join(dir, "candidate_outputs.json"),
        JSON.stringify(payload.candidateOutputs ?? [], null, 2),
        "utf8"
      ),
      fs.writeFile(
        path.join(dir, "agent-output.md"),
        payload.primary?.output ??
          JSON.stringify({ status: "not_applicable", reason: "boundary stopped before agent" }, null, 2),
        "utf8"
      ),
      fs.writeFile(
        path.join(dir, "critic.md"),
        payload.critic?.output ??
          JSON.stringify({ status: "not_applicable", reason: "boundary stopped before critic" }, null, 2),
        "utf8"
      ),
      fs.writeFile(
        path.join(dir, "critic.json"),
        JSON.stringify(
          payload.criticReview ?? { status: "not_applicable", reason: "critic not run" },
          null,
          2
        ),
        "utf8"
      ),
      fs.writeFile(
        path.join(dir, "repair.md"),
        payload.repair ?? JSON.stringify({ status: "not_applicable", reason: "no repair needed" }, null, 2),
        "utf8"
      ),
      fs.writeFile(
        path.join(dir, "formatter.md"),
        payload.formatter ??
          JSON.stringify({ status: "not_applicable", reason: "boundary stopped before formatter" }, null, 2),
        "utf8"
      ),
      fs.writeFile(path.join(dir, "final.md"), payload.final, "utf8"),
      fs.writeFile(
        path.join(dir, "trace.json"),
        JSON.stringify(payload.trace, null, 2),
        "utf8"
      )
    ]);

    await new LearningRecorder(this.rootDir).recordRun(payload, dir);

    return dir;
  }
}
