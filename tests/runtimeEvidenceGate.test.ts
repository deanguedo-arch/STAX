import { describe, expect, it } from "vitest";
import { RuntimeEvidenceGate } from "../src/evidence/RuntimeEvidenceGate.js";

describe("RuntimeEvidenceGate", () => {
  const gate = new RuntimeEvidenceGate();

  it("treats package script discovery as unknown runtime truth", () => {
    const result = gate.evaluate({
      claim: "Tests passed",
      evidence: "package.json scripts: npm test, npm run build"
    });

    expect(result.status).toBe("unknown");
    expect(result.strength).toBe("script_discovered");
    expect(result.unverifiedScope).toContain("Runtime/build/test pass or fail result");
  });

  it("treats test file discovery as unknown pass/fail truth", () => {
    const result = gate.evaluate({
      claim: "The test suite passes",
      evidence: "tests/parser.test.ts exists"
    });

    expect(result.status).toBe("unknown");
    expect(result.strength).toBe("test_file_discovered");
  });

  it("treats pasted command output as partial evidence", () => {
    const result = gate.evaluate({
      claim: "The build passed",
      evidence: "$ npm run build\n> build\npassed 12 tests"
    });

    expect(result.status).toBe("partial");
    expect(result.strength).toBe("pasted_command_output");
  });

  it("treats stored command evidence as scoped verified", () => {
    const result = gate.evaluate({
      claim: "Regression eval passed",
      evidence: "stored command evidence: command-evidence/eval-regression.json stdoutPath=evals/eval_results/latest.json"
    });

    expect(result.status).toBe("scoped_verified");
    expect(result.strength).toBe("stored_command_evidence");
  });

  it("does not let STAX eval output verify linked repo test pass", () => {
    const result = gate.evaluate({
      claim: "canvas-helper tests pass",
      evidence: "npm run rax -- eval --regression passed for STAX"
    });

    expect(result.status).toBe("unknown");
    expect(result.strength).toBe("local_stax_command_evidence");
    expect(result.unverifiedScope).toContain("Linked repo runtime/build/test result");
  });

  it("lets failed command evidence override vague pass claims", () => {
    const result = gate.evaluate({
      claim: "Tests passed",
      evidence: "$ npm test\nfailed 3 tests\nexit code 1"
    });

    expect(result.status).toBe("failed");
    expect(result.verifiedScope).toContain("Command failure is verified for the supplied output.");
  });
});
