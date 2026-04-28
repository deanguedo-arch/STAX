import { describe, expect, it } from "vitest";
import { BaselineDateGate } from "../src/compare/BaselineDateGate.js";

describe("BaselineDateGate", () => {
  const gate = new BaselineDateGate();

  it("blocks superiority with one capture date", () => {
    const result = gate.evaluate({
      now: "2026-04-28T12:00:00.000Z",
      records: [
        { caseId: "a", externalCapturedAt: "2026-04-28T10:00:00.000Z" },
        { caseId: "b", externalCapturedAt: "2026-04-28T11:00:00.000Z" }
      ]
    });

    expect(result.status).toBe("one_day_slice");
    expect(result.blockingReasons.join(" ")).toContain("at least 2 dates");
  });

  it("allows multi-day eligibility with two dates", () => {
    const result = gate.evaluate({
      now: "2026-04-28T12:00:00.000Z",
      records: [
        { caseId: "a", externalCapturedAt: "2026-04-27T10:00:00.000Z" },
        { caseId: "b", externalCapturedAt: "2026-04-28T11:00:00.000Z" }
      ]
    });

    expect(result.status).toBe("multi_day_eligible");
    expect(result.uniqueDateCount).toBe(2);
  });

  it("warns on stale baselines", () => {
    const result = gate.evaluate({
      now: "2026-04-28T12:00:00.000Z",
      staleAfterDays: 10,
      records: [
        { caseId: "old", externalCapturedAt: "2026-03-01T10:00:00.000Z" },
        { caseId: "new", externalCapturedAt: "2026-04-28T10:00:00.000Z" }
      ]
    });

    expect(result.warnings.join(" ")).toContain("stale");
  });

  it("does not count duplicated captures twice", () => {
    const result = gate.evaluate({
      now: "2026-04-28T12:00:00.000Z",
      records: [
        { caseId: "a", externalCapturedAt: "2026-04-27T10:00:00.000Z", externalAnswerHash: "same", promptHash: "p", externalAnswerSource: "s" },
        { caseId: "b", externalCapturedAt: "2026-04-28T10:00:00.000Z", externalAnswerHash: "same", promptHash: "p", externalAnswerSource: "s" }
      ]
    });

    expect(result.ignoredDuplicates).toContain("b");
    expect(result.uniqueDateCount).toBe(1);
  });
});
