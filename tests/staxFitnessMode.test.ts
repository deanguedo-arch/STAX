import { describe, expect, it } from "vitest";
import { validateModeOutput } from "../src/utils/validators.js";

describe("STAX fitness mode", () => {
  it("rejects forbidden unsupported phrases", () => {
    const result = validateModeOutput(
      "stax_fitness",
      [
        "## Signal Units",
        "He is obviously in great shape.",
        "## Timeline",
        "## Pattern Candidates",
        "## Deviations",
        "## Unknowns",
        "## Confidence Summary"
      ].join("\n")
    );

    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toContain("forbidden");
  });
});
