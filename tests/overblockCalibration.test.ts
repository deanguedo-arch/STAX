import { describe, expect, it } from "vitest";
import {
  loadOverblockCalibrationCases,
  runOverblockCalibration
} from "../src/campaign/OverblockCalibration.js";

describe("overblock calibration", () => {
  it("keeps a 100-case calibration fixture gate live", async () => {
    const cases = await loadOverblockCalibrationCases();
    expect(cases).toHaveLength(100);
  });

  it("keeps false accepts at zero and false rejects at or below 15 percent", async () => {
    const result = await runOverblockCalibration(process.cwd());

    expect(result.taskCount).toBe(100);
    expect(result.sufficientProofCases).toBe(50);
    expect(result.insufficientProofCases).toBe(50);
    expect(result.falseAccepts).toBe(0);
    expect(result.falseRejectRatePct).toBeLessThanOrEqual(15);
    expect(result.status).toBe("calibration_passed");
  }, 60000);
});
