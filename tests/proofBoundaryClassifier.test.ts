import { describe, expect, it } from "vitest";
import { ProofBoundaryClassifier } from "../src/evidence/ProofBoundaryClassifier.js";

describe("ProofBoundaryClassifier", () => {
  const classifier = new ProofBoundaryClassifier();

  it("does not let DOCX proof verify PDF behavior", () => {
    const result = classifier.classify({
      claim: "PDF parser works",
      evidence: "DOCX parser focused tests passed for .docx fixtures."
    });

    expect(result.evidenceFamily).toBe("docx");
    expect(result.verifiedScope).toContain("DOCX parsing path only");
    expect(result.unverifiedScope).toContain("PDF parsing");
  });

  it("classifies supplied evidence rather than letting claim text steer the family", () => {
    const result = classifier.classify({
      claim: "DOCX parser works",
      evidence: "PDF parser focused tests passed for .pdf fixtures."
    });

    expect(result.evidenceFamily).toBe("pdf");
    expect(result.verifiedScope).toContain("PDF parsing path only");
    expect(result.unverifiedScope).toContain("DOCX parsing");
  });

  it("does not let OCR proof verify structured recovery", () => {
    const result = classifier.classify({
      claim: "Structured recovery works",
      evidence: "OCR-related tests passed for image text extraction."
    });

    expect(result.evidenceFamily).toBe("ocr");
    expect(result.unverifiedScope).toContain("structured recovery");
  });

  it("does not let course-shell proof verify full e2e or rendered preview", () => {
    const result = classifier.classify({
      claim: "The whole course experience works",
      evidence: "npm run test:course-shell passed for generated shell checks."
    });

    expect(result.evidenceFamily).toBe("course_shell");
    expect(result.unverifiedScope).toContain("full e2e flow");
    expect(result.unverifiedScope).toContain("rendered preview");
  });

  it("does not let fixture checks verify rendered exports", () => {
    const result = classifier.classify({
      claim: "Rendered export is correct",
      evidence: "exports:fixtures passed and fixture JSON matched golden output."
    });

    expect(result.evidenceFamily).toBe("fixture");
    expect(result.unverifiedScope).toContain("rendered export");
  });

  it("does not let cf:convert verify cf:validate", () => {
    const result = classifier.classify({
      claim: "Brightspace validation succeeded",
      evidence: "npm run cf:convert completed and produced a package."
    });

    expect(result.evidenceFamily).toBe("conversion");
    expect(result.unverifiedScope).toContain("validation success");
    expect(result.requiredNextProof.join(" ")).toContain("validate");
  });

  it("does not invent npm test when a package has no test script", () => {
    const result = classifier.classify({
      claim: "ADMISSION-APP is tested",
      evidence: "package.json shows no test script; only script is build:pages."
    });

    expect(result.evidenceFamily).toBe("no_test_script");
    expect(result.unverifiedScope).toContain("npm test pass");
    expect(result.requiredNextProof.join(" ")).toContain("build:pages");
  });
});
