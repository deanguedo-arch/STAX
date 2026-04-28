import { describe, expect, it } from "vitest";
import { EvidenceRequestBuilder } from "../src/evidence/EvidenceRequestBuilder.js";

describe("EvidenceRequestBuilder", () => {
  const builder = new EvidenceRequestBuilder();

  it("requests package scripts and command output for vague repo tasks", () => {
    const result = builder.build({ task: "What is wrong with this repo?", availableEvidence: "repo question" });

    expect(result.minimumEvidenceNeeded.join(" ")).toContain("package.json");
    expect(result.pasteBackInstructions).toContain("paste");
  });

  it("requests screenshots for UI tasks", () => {
    const result = builder.build({ task: "Does the checkmark fit in the UI box?" });

    expect(result.requestKind).toBe("ui_question");
    expect(result.minimumEvidenceNeeded.join(" ")).toContain("screenshot");
  });

  it("requests diff and command output for Codex reports", () => {
    const result = builder.build({ task: "Review this Codex final report for a patch." });

    expect(result.requestKind).toBe("codex_report");
    expect(result.minimumEvidenceNeeded).toContain("diff summary");
  });

  it("requests build and deploy logs for deploy issues", () => {
    const result = builder.build({ task: "Why did deployment fail?" });

    expect(result.requestKind).toBe("deploy_issue");
    expect(result.minimumEvidenceNeeded.join(" ")).toContain("deploy output");
  });
});
