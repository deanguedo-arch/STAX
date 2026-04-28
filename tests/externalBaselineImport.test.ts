import { describe, expect, it } from "vitest";
import { ExternalBaselineImport } from "../src/compare/ExternalBaselineImport.js";

describe("ExternalBaselineImport", () => {
  const importer = new ExternalBaselineImport();

  it("accepts a valid external baseline", () => {
    const result = importer.validate({
      caseId: "canvas_course_shell_vs_full_e2e",
      task: "What proof is needed for the Canvas course shell?",
      externalAnswer: "Use the supplied Canvas course evidence, identify the rendered course shell boundary, and require a screenshot plus the relevant test output before claiming the full E2E is verified.",
      externalAnswerSource: "chatgpt-browser-thread",
      externalCapturedAt: "2026-04-28T12:00:00.000Z",
      externalPrompt: "Answer the Canvas course shell proof task using local evidence.",
      captureContext: "fresh_holdout_v2",
      humanConfirmedNotDrifted: true
    });

    expect(result.externalBaselineValid).toBe(true);
  });

  it("rejects missing source metadata", () => {
    const result = importer.validate({
      caseId: "missing-source",
      externalAnswer: "Use the repo evidence and capture a screenshot before claiming visual proof.",
      externalCapturedAt: "2026-04-28T12:00:00.000Z",
      externalPrompt: "Answer the repo task.",
      humanConfirmedNotDrifted: true
    });

    expect(result.externalBaselineValid).toBe(false);
    expect(result.blockingReasons.join(" ")).toContain("source");
  });

  it("rejects stale or generic answers", () => {
    const result = importer.validate({
      caseId: "generic",
      externalAnswer: "Review the repo and improve the code.",
      externalAnswerSource: "chatgpt-browser-thread",
      externalCapturedAt: "2026-04-28T12:00:00.000Z",
      externalPrompt: "Answer the repo task.",
      captureContext: "fresh_holdout_v2",
      humanConfirmedNotDrifted: false
    });

    expect(result.externalBaselineValid).toBe(false);
    expect(result.blockingReasons.join(" ")).toMatch(/generic|drift/);
  });

  it("rejects copied STAX answers", () => {
    const answer = "Capture the rendered preview screenshot, check text fit, and paste back command output before claiming verification.";
    const result = importer.validate({
      caseId: "copied",
      task: "What proof is needed?",
      staxAnswer: answer,
      externalAnswer: answer,
      externalAnswerSource: "chatgpt-browser-thread",
      externalCapturedAt: "2026-04-28T12:00:00.000Z",
      externalPrompt: "Answer the repo task.",
      captureContext: "fresh_holdout_v2",
      humanConfirmedNotDrifted: true
    });

    expect(result.blockingReasons.join(" ")).toContain("copied");
  });
});
