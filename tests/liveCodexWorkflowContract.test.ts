import { describe, expect, it } from "vitest";
import { summarizeLiveCodexWorkflowContract } from "../src/campaign/LiveCodexWorkflowContract.js";

describe("Live Codex workflow contract", () => {
  it("passes a healthy workflow ledger with bounded prompts and usable reports", () => {
    const summary = summarizeLiveCodexWorkflowContract({
      ledger: {
        campaignId: "workflow_contract_v1",
        tasks: [
          {
            taskId: "workflow_ok_001",
            repo: "STAX",
            state: "verified_next_state",
            stateHistory: [
              { state: "created", note: "created" },
              { state: "scoped", note: "scoped" },
              { state: "prompt_generated", note: "prompt" },
              { state: "codex_report_received", note: "report" },
              { state: "diff_collected", note: "diff" },
              { state: "command_evidence_collected", note: "command" },
              { state: "audited", note: "audit" },
              { state: "verified_next_state", note: "done" }
            ],
            objective: "Audit whether a STAX slice is verified.",
            staxInitialAudit: "audit",
            staxCodexPrompt:
              "Work only in /Users/deanguedo/Documents/GitHub/STAX. Inspect the touched files. Run exactly npm test. Return cwd, exact command, exit code, files changed, and the first failure if it does not pass. Do not widen scope.",
            codexReport:
              "Files changed: src/agents/AnalystAgent.ts\nCommands run: npm test (exit code 0)\nWhat is verified: targeted tests passed locally\nWhat is unverified: broader workflow behavior\nRisks: wider runtime coverage was not rerun",
            diffEvidence: "Changed files: src/agents/AnalystAgent.ts",
            commandEvidence: "cwd=/Users/deanguedo/Documents/GitHub/STAX\n$ npm test\nExit code: 0",
            staxPostCodexAudit: "post",
            nextAction: "Stop at the bounded proof surface.",
            cleanupPromptsAfterCodex: 0,
            finalOutcome: "verified_next_state",
            falseAccept: false,
            falseBlock: false,
            usefulBlock: false,
            verifiedAccept: true,
            staxInitialPromptUseful: true,
            evalCandidate: false
          },
          ...Array.from({ length: 9 }, (_, index) => ({
            taskId: `workflow_ok_${index + 2}`,
            repo: index % 2 === 0 ? "ADMISSION-APP" : "canvas-helper",
            state: "blocked_pending_evidence" as const,
            stateHistory: [
              { state: "created" as const, note: "created" },
              { state: "scoped" as const, note: "scoped" },
              { state: "prompt_generated" as const, note: "prompt" },
              { state: "codex_report_received" as const, note: "report" },
              { state: "audited" as const, note: "audit" },
              { state: "blocked_pending_evidence" as const, note: "done" }
            ],
            objective: "Audit whether a bounded repo slice is proven.",
            staxInitialAudit: "audit",
            staxCodexPrompt:
              "Work only in /Users/deanguedo/Documents/GitHub/ADMISSION-APP. Inspect the touched files and run exactly one read-only validation command. Return cwd, exact command, exit code, files changed, and the first failure if it does not pass. Do not publish, sync, or deploy.",
            codexReport:
              "Files changed: docs/example.md\nCommands run: none\nWhat is verified: documentation was updated\nWhat is unverified: the bounded runtime proof command has not been run\nRisks: completion would be unsupported without local validation output",
            diffEvidence: "Changed files: docs/example.md",
            commandEvidence: "",
            staxPostCodexAudit: "post",
            nextAction: "Run the bounded read-only proof command before accepting the claim.",
            cleanupPromptsAfterCodex: 0,
            finalOutcome: "blocked_pending_evidence" as const,
            falseAccept: false,
            falseBlock: false,
            usefulBlock: true,
            verifiedAccept: false,
            staxInitialPromptUseful: true,
            evalCandidate: false
          }))
        ]
      }
    });

    expect(summary.status).toBe("workflow_contract_passed");
    expect(summary.taskCount).toBe(10);
    expect(summary.promptUsableRate).toBe(100);
    expect(summary.reportUsableRate).toBe(100);
    expect(summary.nextActionCoverage).toBe(100);
    expect(summary.verifiedOutcomeReportCoverage).toBe(100);
  });

  it("blocks ledgers with weak prompts and missing next actions", () => {
    const summary = summarizeLiveCodexWorkflowContract({
      ledger: {
        campaignId: "workflow_contract_bad",
        tasks: [
          {
            taskId: "workflow_bad_001",
            repo: "STAX",
            state: "verified_next_state",
            stateHistory: [
              { state: "created", note: "created" },
              { state: "scoped", note: "scoped" },
              { state: "prompt_generated", note: "prompt" },
              { state: "codex_report_received", note: "report" },
              { state: "audited", note: "audit" },
              { state: "verified_next_state", note: "done" }
            ],
            objective: "Audit a weak workflow task.",
            staxInitialAudit: "audit",
            staxCodexPrompt: "Check it.",
            codexReport: "I fixed it and tests passed.",
            diffEvidence: "",
            commandEvidence: "",
            staxPostCodexAudit: "post",
            cleanupPromptsAfterCodex: 0,
            finalOutcome: "verified_next_state",
            falseAccept: false,
            falseBlock: false,
            usefulBlock: false,
            verifiedAccept: true,
            staxInitialPromptUseful: true,
            evalCandidate: false
          }
        ]
      }
    });

    expect(summary.status).toBe("workflow_contract_blocked");
    expect(summary.blockers).toContain("fewer than 10 live Codex workflow tasks recorded");
    expect(summary.blockers).toContain("at least one live Codex workflow prompt is weak");
    expect(summary.blockers).toContain("not every live Codex workflow task has exactly one next action recorded");
    expect(summary.blockers).toContain("verified workflow outcomes are missing usable Codex report contracts");
  });
});
