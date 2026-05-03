import { describe, expect, it } from "vitest";
import { validateCiFailureTriageGate } from "../src/campaign/CiFailureTriageGate.js";

describe("CI failure triage gate", () => {
  it("passes all fixture cases at full score", async () => {
    const summary = await validateCiFailureTriageGate();

    expect(summary.status).toBe("passed");
    expect(summary.caseCount).toBe(24);
    expect(summary.passingCount).toBe(summary.caseCount);
    expect(summary.likelyCauseAccuracyPct).toBe(100);
    expect(summary.proofStrengthAccuracyPct).toBe(100);
    expect(summary.nextActionAccuracyPct).toBe(100);
    expect(summary.issues).toEqual([]);
  });
});
