import { describe, expect, it } from "vitest";
import { VisualEvidenceProtocol } from "../src/evidence/VisualEvidenceProtocol.js";

describe("VisualEvidenceProtocol", () => {
  const protocol = new VisualEvidenceProtocol();

  it("does not treat CSS/source files as rendered proof", () => {
    const result = protocol.evaluate({
      target: "Sports Wellness rendered preview",
      artifactType: "missing",
      sourceEvidenceOnly: true,
      requiredChecks: ["text fit"]
    });

    expect(result.status).toBe("missing");
    expect(result.unverifiedClaims).toContain("text fit");
  });

  it("treats screenshot without checklist as partial", () => {
    const result = protocol.evaluate({
      target: "Sports Wellness rendered preview",
      artifactType: "screenshot",
      artifactPath: "evidence/screenshot.png",
      route: "/preview/workspace/sportswellness",
      viewport: "1280x720"
    });

    expect(result.status).toBe("partial");
  });

  it("verifies listed checks only", () => {
    const result = protocol.evaluate({
      target: "Sports Wellness rendered preview",
      artifactType: "playwright_screenshot",
      artifactHash: "abc123",
      route: "/preview/workspace/sportswellness",
      viewport: "1280x720",
      requiredChecks: ["text fit", "border symmetry"],
      observedChecks: ["text fit"]
    });

    expect(result.status).toBe("partial");
    expect(result.verifiedClaims).toContain("text fit");
    expect(result.unverifiedClaims).toContain("border symmetry");
  });

  it("does not let visual evidence prove runtime success", () => {
    const result = protocol.evaluate({
      target: "Rendered preview",
      artifactType: "screenshot",
      artifactHash: "abc123",
      route: "/preview",
      viewport: "1280x720",
      requiredChecks: ["tests passed"],
      observedChecks: []
    });

    expect(result.unverifiedClaims).toContain("tests passed");
  });
});
