import { describe, expect, it } from "vitest";
import { validatePrReviewCommentGate } from "../src/campaign/PrReviewCommentGate.js";

describe("PR review comment gate", () => {
  it("keeps review comments focused and passes all fixture cases", async () => {
    const summary = await validatePrReviewCommentGate();

    expect(summary.status).toBe("passed");
    expect(summary.caseCount).toBe(15);
    expect(summary.passingCount).toBe(summary.caseCount);
    expect(summary.usefulCommentRate).toBe(100);
    expect(summary.issues).toEqual([]);
  });
});
