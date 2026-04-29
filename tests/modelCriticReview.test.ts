import { describe, expect, it } from "vitest";
import {
  modelCriticIssuesFromReview,
  parseModelCriticReview,
  renderModelCriticReview
} from "../src/schemas/ModelCriticReview.js";

describe("ModelCriticReviewSchema", () => {
  it("parses structured critic JSON and exposes concrete failure issues", () => {
    const review = parseModelCriticReview(JSON.stringify({
      pass: false,
      severity: "major",
      reasoningQuality: "weak",
      evidenceQuality: "missing",
      unsupportedClaims: ["tests passed without local command evidence"],
      inventedSpecifics: ["named src/missing.ts without evidence"],
      fakeCompleteRisk: ["claimed done"],
      missingNextAction: ["no exact proof command"],
      policyViolations: [],
      requiredFixes: ["remove hard runtime claim"],
      confidence: "high"
    }));

    expect(review?.pass).toBe(false);
    expect(modelCriticIssuesFromReview(review!)).toContain(
      "Model critic failure: unsupported claim: tests passed without local command evidence"
    );
  });

  it("renders structured critic output with parseable JSON for runtime enforcement", () => {
    const review = parseModelCriticReview(`\`\`\`json
{"pass":true,"severity":"none","reasoningQuality":"strong","evidenceQuality":"strong","confidence":"high"}
\`\`\``);

    expect(review?.pass).toBe(true);
    const rendered = renderModelCriticReview(review!);
    expect(rendered).toContain("## Structured Critic Review");
    expect(parseModelCriticReview(rendered)?.confidence).toBe("high");
  });
});
