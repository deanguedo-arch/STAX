import { describe, expect, it } from "vitest";
import { evaluateRealUseReplayOutput, type RealUseReplayExpectation } from "../src/campaign/RealUseReplayGate.js";

const expectation: RealUseReplayExpectation = {
  taskId: "case",
  required: ["npm run typecheck", "npm test"],
  forbidden: ["TestFlight"]
};

describe("evaluateRealUseReplayOutput", () => {
  it("passes when required markers are present and forbidden markers are absent", () => {
    const result = evaluateRealUseReplayOutput("Run npm run typecheck and npm test from STAX.", expectation);
    expect(result.pass).toBe(true);
  });

  it("fails when required markers are missing", () => {
    const result = evaluateRealUseReplayOutput("Run npm test from STAX.", expectation);
    expect(result.pass).toBe(false);
    expect(result.missing).toContain("npm run typecheck");
  });

  it("fails when forbidden markers are present", () => {
    const result = evaluateRealUseReplayOutput("Run npm run typecheck and npm test. TestFlight is unrelated.", expectation);
    expect(result.pass).toBe(false);
    expect(result.forbiddenFound).toContain("TestFlight");
  });
});
