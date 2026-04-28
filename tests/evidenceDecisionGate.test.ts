import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decideEvidence, renderEvidenceDecision } from "../src/audit/EvidenceDecisionGate.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-evidence-gate-"));
}

describe("EvidenceDecisionGate", () => {
  it("treats pasted test claims as human-provided, not verified local command evidence", () => {
    const decision = decideEvidence("Codex says npm test passed, but the only evidence is pasted text from a user.");

    expect(decision.decision).toBe("reasoned_opinion");
    expect(decision.evidenceClasses).toContain("pasted_human");
    expect(decision.evidenceClasses).not.toContain("local_command");
    expect(decision.requiredNextProof.join(" ")).toContain("local command/eval/trace evidence");
  });

  it("does not turn pasted eval pass claims into local eval evidence", () => {
    const decision = decideEvidence("Codex says npm run rax -- eval passed with passRate: 1.");

    expect(decision.decision).toBe("reasoned_opinion");
    expect(decision.evidenceClasses).toContain("pasted_human");
    expect(decision.evidenceClasses).not.toContain("local_eval");
    expect(decision.evidenceClasses).not.toContain("local_command");
  });

  it("treats file path evidence as partial until command or trace proof is tied to the claim", () => {
    const decision = decideEvidence("## Local Evidence\n- File inspected: src/audit/VerifiedAuditContract.ts");

    expect(decision.decision).toBe("partial");
    expect(decision.evidenceClasses).toContain("local_file");
    expect(decision.evidenceClasses).not.toContain("local_command");
  });

  it("allows verified only with local command, trace or eval, and claim-linked evidence", () => {
    const decision = decideEvidence([
      "## Local Evidence",
      "- Trace: runs/2026-04-27/run-2026-04-27T04-00-00-000Z-abcd/trace.json",
      "- Path: evals/eval_results/2026-04-27T04-00-00-000Z.json",
      "- npm test passed exit code 0",
      "- ClaimSupported: behavior mining triage remained candidate-only."
    ].join("\n"));

    expect(decision.decision).toBe("verified");
    expect(decision.confidence).toBe("high");
    expect(decision.evidenceClasses).toEqual(expect.arrayContaining(["local_command", "local_trace", "local_eval"]));
  });

  it("blocks verification when pass and fail evidence conflict", () => {
    const decision = decideEvidence([
      "## Local Evidence",
      "- npm test passed exit code 0",
      "- Earlier npm test failed exit code 1",
      "- Trace: runs/2026-04-27/run-2026-04-27T04-00-00-000Z-abcd/trace.json",
      "- ClaimSupported: tests are stable."
    ].join("\n"));

    expect(decision.decision).toBe("blocked_for_evidence");
    expect(decision.requiredNextProof.join(" ")).toContain("Resolve the conflicting");
  });

  it("does not treat zero failed counts as conflicting evidence", () => {
    const decision = decideEvidence([
      "## Local Evidence",
      "- Path: evals/eval_results/2026-04-27T04-00-00-000Z.json",
      "- npm run rax -- eval --regression passed; 47/47 passed; failed=0; criticalFailures: 0",
      "- ClaimSupported: regression eval passed for STAX."
    ].join("\n"));

    expect(decision.decision).not.toBe("blocked_for_evidence");
  });

  it("is a pure classifier and writes nothing", async () => {
    const rootDir = await tempRoot();
    decideEvidence("Codex says tests pass.");

    await expect(fs.readdir(rootDir)).resolves.toEqual([]);
    expect(renderEvidenceDecision(decideEvidence("No local evidence supplied.")).join("\n")).toContain("## Evidence Decision");
  });
});
