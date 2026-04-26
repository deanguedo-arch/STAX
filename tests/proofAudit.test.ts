import { describe, expect, it } from "vitest";
import { scoreEvidenceText, scoreProofPacket } from "../src/audit/EvidenceSufficiencyScorer.js";
import { createProofPacket, ProofPacketSchema, renderProofPacket } from "../src/audit/ProofPacket.js";
import { redactProofText } from "../src/audit/ProofRedactor.js";

describe("proof audit utilities", () => {
  it("validates proof packets with evidence and ambiguity warnings", () => {
    const packet = createProofPacket({
      workspace: "default",
      threadId: "thread_default",
      runId: "run-2026-04-26T00-00-00-000Z-test",
      runCreatedAt: "2026-04-26T00:00:00.000Z",
      mode: "codex_audit",
      boundaryMode: "allow",
      selectedAgent: "analyst",
      validationStatus: "passed",
      learningEventId: "learn-test",
      learningQueues: ["trace_only"],
      policiesApplied: ["default"],
      evidenceItems: [
        {
          evidenceId: "ev_trace",
          evidenceType: "trace",
          path: "runs/2026-04-26/run-2026-04-26T00-00-00-000Z-test/trace.json",
          summary: "Trace exists.",
          claimSupported: "Runtime trace exists.",
          confidence: "high"
        }
      ],
      redactions: [],
      ambiguityWarnings: ["Global latest run differs from thread latest run."]
    });

    expect(ProofPacketSchema.safeParse(packet).success).toBe(true);
    expect(renderProofPacket(packet)).toContain("Global latest run differs");
  });

  it("requires concrete, relevant, unambiguous evidence for Verified Audit", () => {
    const packet = createProofPacket({
      learningQueues: [],
      policiesApplied: [],
      evidenceItems: [
        {
          evidenceId: "ev_trace",
          evidenceType: "trace",
          path: "runs/2026-04-26/run-test/trace.json",
          summary: "Trace exists.",
          claimSupported: "Runtime route was recorded.",
          confidence: "high"
        },
        {
          evidenceId: "ev_eval",
          evidenceType: "eval",
          path: "evals/eval_results/latest.json",
          command: "npm run rax -- eval",
          summary: "Eval passed.",
          claimSupported: "Regression evidence is available.",
          confidence: "high"
        }
      ]
    });

    expect(scoreProofPacket(packet).canClaimVerifiedAudit).toBe(true);
  });

  it("blocks Verified Audit when evidence is ambiguous or unrelated", () => {
    const unrelated = createProofPacket({
      learningQueues: [],
      policiesApplied: [],
      evidenceItems: [
        {
          evidenceId: "ev_file",
          evidenceType: "file",
          path: "docs/PLAN.md",
          summary: "Plan text was supplied.",
          confidence: "medium"
        }
      ]
    });
    const ambiguous = createProofPacket({
      learningQueues: [],
      policiesApplied: [],
      ambiguityWarnings: ["Multiple possible latest runs."],
      evidenceItems: [
        {
          evidenceId: "ev_trace",
          evidenceType: "trace",
          path: "runs/2026-04-26/run-test/trace.json",
          summary: "Trace exists.",
          claimSupported: "Runtime route was recorded.",
          confidence: "high"
        },
        {
          evidenceId: "ev_eval",
          evidenceType: "eval",
          path: "evals/eval_results/latest.json",
          command: "npm run rax -- eval",
          summary: "Eval passed.",
          claimSupported: "Eval passed.",
          confidence: "high"
        }
      ]
    });

    expect(scoreProofPacket(unrelated).canClaimVerifiedAudit).toBe(false);
    expect(scoreProofPacket(ambiguous).canClaimVerifiedAudit).toBe(false);
  });

  it("scores plan-only audit text below Verified Audit", () => {
    const score = scoreEvidenceText("Codex says everything is complete. No command output was supplied.");

    expect(score.canClaimVerifiedAudit).toBe(false);
    expect(score.hasOnlyUserProvidedClaims).toBe(true);
  });

  it("redacts proof text secrets and records redactions", () => {
    const redacted = redactProofText([
      "OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz123456",
      "Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
      "-----BEGIN PRIVATE KEY-----",
      "secret-material",
      "-----END PRIVATE KEY-----"
    ].join("\n"));

    expect(redacted.text).not.toContain("sk-abcdefghijklmnopqrstuvwxyz123456");
    expect(redacted.text).not.toContain("secret-material");
    expect(redacted.text).toContain("[REDACTED_OPENAI_KEY]");
    expect(redacted.text).toContain("[REDACTED_PRIVATE_KEY]");
    expect(redacted.redactions.length).toBeGreaterThanOrEqual(2);
  });
});
