import { describe, expect, it } from "vitest";
import { validateModeOutput } from "../src/utils/validators.js";

describe("validateModeOutput", () => {
  it("accepts valid intake output", () => {
    const result = validateModeOutput("intake", [
      "## Signal Units",
      "",
      "### SU-001",
      "- Type: training",
      "- Source: user",
      "- Raw Input: trained",
      "- Observed Fact: Dean trained.",
      "- Confidence: high",
      "",
      "## Unknowns"
    ].join("\n"));

    expect(result.valid).toBe(true);
  });

  it("rejects interpretation in intake mode", () => {
    const result = validateModeOutput(
      "intake",
      "## Signal Units\nThis means Dean is probably improving rapidly.\n## Unknowns"
    );

    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toContain("interpretation");
  });
});
