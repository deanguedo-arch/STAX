import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { RunLoggerPayload } from "../core/RunLogger.js";
import type { RunTrace } from "../schemas/RunLog.js";
import type { LearningEvent, LearningEventStatus, LearningFailureType } from "./LearningEvent.js";
import { LearningEventSchema } from "./LearningEvent.js";
import { GenericOutputDetector } from "./GenericOutputDetector.js";
import { LearningClassifier } from "./LearningClassifier.js";
import { LearningMetricsStore } from "./LearningMetrics.js";
import { LearningProposalGenerator } from "./LearningProposalGenerator.js";
import { LearningQueue } from "./LearningQueue.js";

export type CommandLearningInput = {
  commandName: string;
  argsSummary: string;
  success: boolean;
  outputSummary: string;
  exitStatus?: number;
  artifactPaths?: string[];
  runId?: string;
  mode?: string;
};

export class LearningRecorder {
  constructor(private rootDir = process.cwd()) {}

  async recordRun(payload: RunLoggerPayload, runDir: string): Promise<LearningEvent> {
    const existing = await this.existingRunEvent(runDir);
    if (existing) return existing;
    const relativeRunDir = path.relative(this.rootDir, runDir);
    const status = this.statusFor(payload);
    const generic = new GenericOutputDetector().analyze(payload.trace.mode, payload.final);
    const failureTypes = this.failureTypesFor(status, payload, generic.failureTypes);
    const hasFailure = failureTypes.length > 0;
    const eventId = this.eventIdForRun(payload.runId);
    const event: LearningEvent = {
      eventId,
      runId: payload.runId,
      createdAt: new Date().toISOString(),
      input: {
        raw: payload.input,
        normalized: payload.input.trim(),
        summary: this.summary(payload.input)
      },
      output: {
        raw: payload.final,
        summary: this.summary(payload.final),
        mode: payload.trace.mode,
        schemaValid: Boolean(payload.trace.validation?.valid ?? payload.trace.validation),
        criticPassed: payload.criticReview?.pass ?? status !== "critic_failure",
        repairAttempted: Boolean(payload.repair && !payload.repair.includes("not_applicable")),
        finalStatus: status
      },
      routing: {
        detectedMode: payload.mode?.mode ?? payload.trace.mode,
        modeConfidence: payload.mode?.confidence ?? payload.trace.modeConfidence,
        selectedAgent: payload.trace.selectedAgent,
        policiesApplied: payload.trace.policiesApplied,
        providerRoles: payload.trace.providerRoles
      },
      commands: {
        requested: payload.trace.toolCalls.map((call) => call.tool),
        allowed: payload.trace.toolCalls.filter((call) => call.allowed).map((call) => call.tool),
        denied: payload.trace.toolCalls.filter((call) => !call.allowed).map((call) => call.tool)
      },
      qualitySignals: {
        ...generic.qualitySignals,
        unsupportedClaims: payload.criticReview?.unsupportedClaims ?? generic.qualitySignals.unsupportedClaims
      },
      failureClassification: {
        hasFailure,
        failureTypes,
        severity: this.severityFor(failureTypes, payload.criticReview?.severity),
        explanation: hasFailure ? generic.explanation : "Run completed without learning failure."
      },
      proposedQueues: [],
      approvalState: "trace_only",
      links: {
        tracePath: path.join(relativeRunDir, "trace.json"),
        finalPath: path.join(relativeRunDir, "final.md"),
        criticPath: path.join(relativeRunDir, "critic.md"),
        repairPath: path.join(relativeRunDir, "repair.md")
      }
    };
    event.proposedQueues = new LearningClassifier().classify(event);
    event.approvalState = event.proposedQueues.length === 1 && event.proposedQueues[0] === "trace_only" ? "trace_only" : "pending_review";
    return this.persist(event, runDir, payload.trace);
  }

  async recordCommand(input: CommandLearningInput): Promise<LearningEvent> {
    const runId = input.runId ?? `cmd-${this.hash([input.commandName, input.argsSummary, input.outputSummary].join("\n"))}`;
    const eventId = this.eventIdForRun(runId);
    const eventPath = path.join("learning", "events", "hot", `${eventId}.json`);
    const existing = await this.readEventFile(path.join(this.rootDir, eventPath));
    if (existing) return existing;
    const status: LearningEventStatus = input.success ? "success" : input.commandName.includes("eval") ? "eval_failure" : "command_failure";
    const failureTypes: LearningFailureType[] = input.success ? [] : [status === "eval_failure" ? "eval_failure" : "command_failure"];
    const event: LearningEvent = {
      eventId,
      runId,
      createdAt: new Date().toISOString(),
      command: {
        name: input.commandName,
        argsSummary: input.argsSummary,
        exitStatus: input.exitStatus,
        success: input.success,
        outputSummary: input.outputSummary,
        artifactPaths: input.artifactPaths ?? []
      },
      input: {
        raw: input.argsSummary,
        normalized: input.argsSummary.trim(),
        summary: this.summary(input.argsSummary)
      },
      output: {
        raw: input.outputSummary,
        summary: this.summary(input.outputSummary),
        mode: input.mode ?? "command",
        schemaValid: input.success,
        criticPassed: input.success,
        repairAttempted: false,
        finalStatus: status
      },
      routing: {
        detectedMode: input.mode ?? "command",
        modeConfidence: 1,
        selectedAgent: "cli",
        policiesApplied: [],
        providerRoles: {}
      },
      commands: {
        requested: [input.commandName],
        allowed: input.success ? [input.commandName] : [],
        denied: input.success ? [] : [input.commandName]
      },
      qualitySignals: {
        genericOutputScore: 0,
        specificityScore: input.success ? 1 : 0.25,
        actionabilityScore: input.success ? 1 : 0.25,
        evidenceScore: input.artifactPaths?.length ? 1 : 0.5,
        missingSections: [],
        forbiddenPatterns: [],
        unsupportedClaims: []
      },
      failureClassification: {
        hasFailure: failureTypes.length > 0,
        failureTypes,
        severity: failureTypes.length > 0 ? "major" : "none",
        explanation: input.success ? "Command completed." : `${input.commandName} failed or reported a failing result.`
      },
      proposedQueues: [],
      approvalState: "trace_only",
      links: {
        tracePath: eventPath,
        finalPath: eventPath
      }
    };
    event.proposedQueues = new LearningClassifier().classify(event);
    event.approvalState = event.proposedQueues.length === 1 && event.proposedQueues[0] === "trace_only" ? "trace_only" : "pending_review";
    return this.persist(event);
  }

  private async persist(event: LearningEvent, runDir?: string, trace?: RunTrace): Promise<LearningEvent> {
    LearningEventSchema.parse(event);
    const hotDir = path.join(this.rootDir, "learning", "events", "hot");
    await fs.mkdir(hotDir, { recursive: true });
    await fs.writeFile(path.join(hotDir, `${event.eventId}.json`), JSON.stringify(event, null, 2), "utf8");
    if (runDir) {
      await fs.writeFile(path.join(runDir, "learning_event.json"), JSON.stringify(event, null, 2), "utf8");
      if (trace) {
        const updatedTrace = { ...trace, learningEventId: event.eventId, learningQueues: event.proposedQueues };
        await fs.writeFile(path.join(runDir, "trace.json"), JSON.stringify(updatedTrace, null, 2), "utf8");
      }
    }
    await new LearningQueue(this.rootDir).enqueue(event);
    await new LearningProposalGenerator(this.rootDir).generate(event);
    await new LearningMetricsStore(this.rootDir).update();
    return event;
  }

  private async existingRunEvent(runDir: string): Promise<LearningEvent | undefined> {
    return this.readEventFile(path.join(runDir, "learning_event.json"));
  }

  private async readEventFile(file: string): Promise<LearningEvent | undefined> {
    try {
      return LearningEventSchema.parse(JSON.parse(await fs.readFile(file, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  private eventIdForRun(runId: string): string {
    return `learn-${runId.replace(/^(run|cmd)-/, "")}`;
  }

  private hash(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
  }

  private summary(value: string): string {
    const cleaned = value.replace(/\s+/g, " ").trim();
    return cleaned.length > 240 ? `${cleaned.slice(0, 237)}...` : cleaned;
  }

  private statusFor(payload: RunLoggerPayload): LearningEventStatus {
    if (payload.boundary.mode === "refuse" || payload.boundary.mode === "redirect") return "refusal";
    if (payload.criticReview && !payload.criticReview.pass) return "critic_failure";
    if (payload.trace.validation && payload.trace.validation.valid === false) return "schema_failure";
    return "success";
  }

  private failureTypesFor(
    status: LearningEventStatus,
    payload: RunLoggerPayload,
    genericFailures: LearningFailureType[]
  ): LearningFailureType[] {
    const failures = [...genericFailures];
    if (status === "critic_failure") failures.push("critic_failure");
    if (status === "schema_failure") failures.push("schema_failure");
    if (payload.criticReview?.unsupportedClaims.length) failures.push("unsupported_claim");
    return Array.from(new Set(failures));
  }

  private severityFor(failureTypes: LearningFailureType[], criticSeverity?: "none" | "minor" | "major" | "critical") {
    if (criticSeverity && criticSeverity !== "none") return criticSeverity;
    if (failureTypes.includes("schema_failure") || failureTypes.includes("critic_failure")) return "major";
    if (failureTypes.length > 0) return "minor";
    return "none";
  }
}

