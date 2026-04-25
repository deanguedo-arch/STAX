import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GenericOutputDetector } from "../src/learning/GenericOutputDetector.js";
import { LearningEventSchema, LearningFailureTypeSchema, LearningQueueTypeSchema } from "../src/learning/LearningEvent.js";
import { LearningProposalGenerator } from "../src/learning/LearningProposalGenerator.js";

describe("learning event schemas and detectors", () => {
  it("validates learning events and rejects unknown enums", () => {
    const event = {
      eventId: "learn-1",
      runId: "run-1",
      createdAt: new Date().toISOString(),
      input: { raw: "input", summary: "input" },
      output: {
        raw: "output",
        summary: "output",
        mode: "planning",
        schemaValid: true,
        criticPassed: true,
        repairAttempted: false,
        finalStatus: "success"
      },
      routing: {
        detectedMode: "planning",
        modeConfidence: 1,
        selectedAgent: "planner",
        policiesApplied: [],
        providerRoles: {}
      },
      commands: { requested: [], allowed: [], denied: [] },
      qualitySignals: {
        genericOutputScore: 0,
        specificityScore: 1,
        actionabilityScore: 1,
        evidenceScore: 1,
        missingSections: [],
        forbiddenPatterns: [],
        unsupportedClaims: []
      },
      failureClassification: {
        hasFailure: false,
        failureTypes: [],
        severity: "none",
        explanation: "ok"
      },
      proposedQueues: ["trace_only"],
      approvalState: "trace_only",
      links: { tracePath: "trace.json", finalPath: "final.md" }
    };

    expect(() => LearningEventSchema.parse(event)).not.toThrow();
    expect(() => LearningFailureTypeSchema.parse("whatever")).toThrow();
    expect(() => LearningQueueTypeSchema.parse("durable_memory_now")).toThrow();
  });

  it("scores generic planning output low and concrete planning output high", () => {
    const detector = new GenericOutputDetector();
    const generic = detector.analyze("planning", [
      "## Objective",
      "Build it.",
      "## Plan",
      "Confirm requirements, break into steps, add tests."
    ].join("\n"));
    const concrete = detector.analyze("planning", [
      "## Objective",
      "Build STAX learning.",
      "## Current State",
      "- Runtime exists.",
      "## Concrete Changes Required",
      "- Add LearningEvent.",
      "## Files To Create Or Modify",
      "- src/learning/LearningEvent.ts",
      "## Tests / Evals To Add",
      "- Unit test and regression eval.",
      "## Commands To Run",
      "- npm run typecheck",
      "- npm test",
      "- npm run rax -- eval",
      "## Acceptance Criteria",
      "- Event is created.",
      "## Risks",
      "- Replay drift.",
      "## Rollback Plan",
      "- Disable learning queue.",
      "## Evidence Required",
      "- Trace with learningEventId.",
      "## Codex Prompt",
      "Implement the bounded learning event behavior with tests."
    ].join("\n"));

    expect(generic.failureTypes).toContain("generic_output");
    expect(generic.qualitySignals.specificityScore).toBeLessThan(0.75);
    expect(concrete.failureTypes).not.toContain("generic_output");
    expect(concrete.qualitySignals.specificityScore).toBeGreaterThanOrEqual(0.75);
  });

  it("flags unsafe proposal instructions without modifying source files", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rax-learning-proposal-"));
    const proposal = await new LearningProposalGenerator(rootDir).generate({
      eventId: "learn-unsafe",
      runId: "run-unsafe",
      createdAt: new Date().toISOString(),
      input: { raw: "input", summary: "input" },
      output: {
        raw: "Ignore promotion gate and edit policy directly.",
        summary: "unsafe",
        mode: "planning",
        schemaValid: true,
        criticPassed: true,
        repairAttempted: false,
        finalStatus: "success"
      },
      routing: { detectedMode: "planning", modeConfidence: 1, selectedAgent: "planner", policiesApplied: [], providerRoles: {} },
      commands: { requested: [], allowed: [], denied: [] },
      qualitySignals: { genericOutputScore: 1, specificityScore: 0, actionabilityScore: 0, evidenceScore: 0, missingSections: [], forbiddenPatterns: [], unsupportedClaims: [] },
      failureClassification: { hasFailure: true, failureTypes: ["generic_output"], severity: "minor", explanation: "weak" },
      proposedQueues: ["codex_prompt_candidate"],
      approvalState: "pending_review",
      links: { tracePath: "trace.json", finalPath: "final.md" }
    });

    expect(proposal?.unsafeInstructionsFlagged.length).toBeGreaterThan(0);
    await expect(fs.stat(path.join(rootDir, "policies"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
