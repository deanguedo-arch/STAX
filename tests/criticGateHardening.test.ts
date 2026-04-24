import { describe, expect, it } from "vitest";
import { CriticGate } from "../src/validators/CriticGate.js";
import { RepairController } from "../src/validators/RepairController.js";

describe("CriticGate hardening", () => {
  it("fails unsupported STAX personality claims with critical severity", () => {
    const review = new CriticGate().review({
      mode: "stax_fitness",
      output: [
        "## Signal Units",
        "### SU-001",
        "- Type: training",
        "- Source: user",
        "- Raw Input: trained once",
        "- Observed Fact: Dean trained once.",
        "- Inference: He is clearly a disciplined person.",
        "- Confidence: medium",
        "## Timeline",
        "## Pattern Candidates",
        "## Deviations",
        "## Unknowns",
        "## Confidence Summary",
        "medium"
      ].join("\n")
    });

    expect(review.pass).toBe(false);
    expect(review.severity).toBe("critical");
    expect(review.forbiddenPhrases).toContain("he is clearly");
    expect(review.unsupportedClaims.join(" ")).toContain("disciplined person");
  });

  it("fails missing required sections", () => {
    const review = new CriticGate().review({
      mode: "planning",
      output: "## Objective\nBuild it."
    });

    expect(review.pass).toBe(false);
    expect(review.schemaIssues.join(" ")).toContain("Missing required heading");
  });

  it("repair controller attempts once and reports remaining issues", () => {
    const first = new RepairController(1).repair("bad", ["missing section"]);
    const second = new RepairController(1).repair("bad", ["still bad"], 1);

    expect(first.attempted).toBe(true);
    expect(first.repairCount).toBe(1);
    expect(second.attempted).toBe(false);
    expect(second.pass).toBe(false);
    expect(second.issuesRemaining).toContain("still bad");
  });
});
