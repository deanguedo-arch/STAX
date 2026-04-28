import { describe, expect, it } from "vitest";
import { HoldoutFreshnessGate } from "../src/compare/HoldoutFreshnessGate.js";

describe("HoldoutFreshnessGate", () => {
  const gate = new HoldoutFreshnessGate();
  const existing = [{
    id: "canvas_proof_gap",
    repo: "canvas-helper",
    taskFamily: "proof_boundary" as const,
    proofBoundary: "rendered visual artifact",
    task: "What proof is missing for the Sports Wellness rendered preview?",
    localEvidence: "projects/sportswellness/workspace/styles.css; rendered preview; package.json",
    externalAnswerSource: "chatgpt-thread-1",
    externalCapturedAt: "2026-04-28T12:00:00.000Z"
  }];

  it("rejects copied or paraphrased proof-gap tasks", () => {
    const result = gate.evaluate({
      candidate: {
        id: "canvas_evidence_absent",
        repo: "canvas-helper",
        task: "What evidence is absent for the Sports Wellness rendered preview?",
        localEvidence: "projects/sportswellness/workspace/styles.css; rendered preview; package.json",
        externalAnswerSource: "chatgpt-thread-2",
        externalCapturedAt: "2026-04-29T12:00:00.000Z"
      },
      existingCases: existing
    });

    expect(result.isFresh).toBe(false);
    expect(result.blockingReasons.join(" ")).toMatch(/too similar|Same repo/);
  });

  it("accepts a new repo with a new proof boundary", () => {
    const result = gate.evaluate({
      candidate: {
        id: "admission_runtime_output",
        repo: "app-admissions",
        taskFamily: "runtime_evidence",
        proofBoundary: "scoped command output",
        task: "What command output proves the admissions export works?",
        localEvidence: "package.json; src/export.ts; repo-script:test",
        externalAnswerSource: "chatgpt-thread-2",
        externalCapturedAt: "2026-04-29T12:00:00.000Z"
      },
      existingCases: existing
    });

    expect(result.isFresh).toBe(true);
    expect(result.freshnessReasons).toContain("new repo");
  });

  it("accepts same repo with a new task family", () => {
    const result = gate.evaluate({
      candidate: {
        id: "canvas_strategy",
        repo: "canvas-helper",
        taskFamily: "strategy",
        proofBoundary: "reasoned strategy",
        task: "Which product strategy should guide Canvas helper next?",
        localEvidence: "README.md; docs/roadmap.md; package.json",
        externalAnswerSource: "chatgpt-thread-2",
        externalCapturedAt: "2026-04-29T12:00:00.000Z"
      },
      existingCases: existing
    });

    expect(result.isFresh).toBe(true);
  });

  it("rejects same repo plus same family plus same boundary", () => {
    const result = gate.evaluate({
      candidate: {
        id: "canvas_visual_again",
        repo: "canvas-helper",
        taskFamily: "proof_boundary",
        proofBoundary: "rendered visual artifact",
        task: "Which verification gap matters for the Sports Wellness visual preview?",
        localEvidence: "projects/sportswellness/workspace/styles.css; rendered preview; package.json",
        externalAnswerSource: "chatgpt-thread-2",
        externalCapturedAt: "2026-04-29T12:00:00.000Z"
      },
      existingCases: existing
    });

    expect(result.isFresh).toBe(false);
    expect(result.blockingReasons.join(" ")).toContain("Same repo");
  });
});
