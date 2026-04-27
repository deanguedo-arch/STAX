import { createHash } from "node:crypto";
import {
  CHAT_OPERATOR_VERSION,
  OperationPlanSchema,
  type OperationExecutionClass,
  type OperationIntent,
  type OperationPlan,
  type OperationRiskLevel
} from "./OperationSchemas.js";

export type ChatIntentContext = {
  knownWorkspaces?: string[];
  currentWorkspace?: string;
};

type PlanInput = {
  intent: OperationIntent;
  originalInput: string;
  workspace?: string;
  objective: string;
  operationsToRun?: string[];
  riskLevel: OperationRiskLevel;
  executionClass: OperationExecutionClass;
  requiresConfirmation?: boolean;
  evidenceRequired?: string[];
  outputContract?: string[];
  reasonCodes?: string[];
  confidence?: "low" | "medium" | "high";
};

export class ChatIntentClassifier {
  classify(input: string, context: ChatIntentContext = {}): OperationPlan {
    const originalInput = input.trim();
    const normalized = normalize(originalInput);

    const highRisk = this.highRiskReason(normalized);
    if (highRisk) {
      return this.plan({
        intent: "unknown",
        originalInput,
        objective: "Block high-risk natural-language operation request.",
        riskLevel: "critical",
        executionClass: "hard_block",
        operationsToRun: [],
        evidenceRequired: ["OperationRiskGate decision"],
        outputContract: ["explain block", "state no action executed", "name next safe path"],
        reasonCodes: [highRisk],
        confidence: "high"
      });
    }

    if (this.isJudgmentDigest(normalized)) {
      return this.plan({
        intent: "judgment_digest",
        originalInput,
        objective: "Show only current persisted items that need human judgment.",
        riskLevel: "low",
        executionClass: "read_only",
        operationsToRun: ["ReviewQueue.list"],
        evidenceRequired: ["review queue"],
        outputContract: ["needs judgment", "blocked", "batch review", "missing refresh note"],
        reasonCodes: ["judgment_digest_intent"],
        confidence: "high"
      });
    }

    const codexReportWorkspace = this.extractCodexReportAuditWorkspace(normalized, context);
    if (codexReportWorkspace !== undefined) {
      return this.plan({
        intent: "codex_report_audit",
        originalInput,
        workspace: codexReportWorkspace,
        objective: "Audit the supplied Codex report against read-only repo evidence and proof requirements.",
        riskLevel: "low",
        executionClass: "low_risk_artifact_creating",
        operationsToRun: ["WorkspaceContext.resolve", "RepoEvidencePack.build", "RaxRuntime.run codex_audit"],
        evidenceRequired: ["supplied Codex report", "workspace registry or current repo", "repo evidence pack", "codex_audit run"],
        outputContract: ["codex report claim", "evidence checked", "claims verified", "claims not verified", "missing command proof", "next proof command"],
        reasonCodes: ["codex_report_audit_intent"],
        confidence: "high"
      });
    }

    const boundedPromptWorkspace = this.extractBoundedPromptWorkspace(normalized, context);
    if (boundedPromptWorkspace !== undefined) {
      return this.plan({
        intent: "workspace_repo_audit",
        originalInput,
        workspace: boundedPromptWorkspace,
        objective: "Create one bounded Codex prompt candidate from read-only repo evidence without mutating the linked repo.",
        riskLevel: "low",
        executionClass: "low_risk_artifact_creating",
        operationsToRun: ["WorkspaceContext.resolve", "RepoEvidencePack.build", "RaxRuntime.run codex_audit"],
        evidenceRequired: ["workspace registry or current repo", "repo evidence pack", "codex_audit run"],
        outputContract: ["bounded Codex prompt", "files to inspect", "command to run", "acceptance criteria", "stop condition"],
        reasonCodes: ["workspace_codex_prompt_request"],
        confidence: "high"
      });
    }

    const deferred = this.deferredReason(normalized);
    if (deferred) {
      return this.plan({
        intent: "unknown",
        originalInput,
        objective: "Defer a broad or artifact-heavy natural-language operation outside Chat Operator v1B.",
        riskLevel: "medium",
        executionClass: "review_only",
        operationsToRun: [],
        evidenceRequired: ["OperationPlan"],
        outputContract: ["state deferred scope", "name slash or CLI power tool", "state no action executed"],
        reasonCodes: [deferred, "deferred_outside_v1a"],
        confidence: "high"
      });
    }

    if (this.isAuditLastProof(normalized)) {
      return this.plan({
        intent: "audit_last_proof",
        originalInput,
        objective: "Audit what the last chat-linked run proves using local proof.",
        riskLevel: "low",
        executionClass: "low_risk_artifact_creating",
        operationsToRun: ["auditLastWithProof"],
        evidenceRequired: ["last run", "trace", "LearningEvent if linked", "local evidence"],
        outputContract: ["proof packet", "evidence checked", "claims verified", "missing evidence"],
        reasonCodes: ["audit_last_proof_intent"],
        confidence: "high"
      });
    }

    if (this.isAuditThisRepo(normalized)) {
      return this.plan({
        intent: "audit_workspace",
        originalInput,
        objective: "Audit the active/current repository with local proof.",
        riskLevel: "low",
        executionClass: "low_risk_artifact_creating",
        operationsToRun: ["WorkspaceContext.resolve", "collectLocalEvidence", "RepoEvidencePack.build", "RaxRuntime.run codex_audit"],
        evidenceRequired: ["workspace registry or current repo", "repo evidence pack", "local evidence", "codex_audit run"],
        outputContract: ["operation plan", "evidence checked", "claims verified", "claims not verified", "risks", "next allowed action"],
        reasonCodes: ["audit_workspace_intent"],
        confidence: "high"
      });
    }

    const repoQuestion = this.extractRepoQuestion(normalized, context);
    if (repoQuestion) {
      return this.plan({
        intent: "workspace_repo_audit",
        originalInput,
        workspace: repoQuestion.workspace,
        objective: repoQuestion.objective,
        riskLevel: "low",
        executionClass: "low_risk_artifact_creating",
        operationsToRun: ["WorkspaceContext.resolve", "RepoEvidencePack.build", "RaxRuntime.run codex_audit"],
        evidenceRequired: ["workspace registry or current repo", "repo evidence pack", "codex_audit run"],
        outputContract: ["workspace/repo", "evidence checked", "files inspected", "scripts found", "risks", "next allowed action"],
        reasonCodes: [repoQuestion.reasonCode],
        confidence: "high"
      });
    }

    const workspace = this.extractAuditWorkspace(normalized, context);
    if (workspace !== undefined) {
      return this.plan({
        intent: "audit_workspace",
        originalInput,
        workspace,
        objective: `Audit workspace ${workspace} with local proof.`,
        riskLevel: "low",
        executionClass: "low_risk_artifact_creating",
        operationsToRun: ["WorkspaceContext.resolve", "collectLocalEvidence", "RepoEvidencePack.build", "RaxRuntime.run codex_audit"],
        evidenceRequired: ["workspace registry or current repo", "repo evidence pack", "local evidence", "codex_audit run"],
        outputContract: ["operation plan", "evidence checked", "claims verified", "claims not verified", "risks", "next allowed action"],
        reasonCodes: ["audit_workspace_intent"],
        confidence: "high"
      });
    }

    return this.plan({
      intent: "unknown",
      originalInput,
      objective: "No Chat Operator v1B control intent detected; use normal runtime fallback.",
      riskLevel: "low",
      executionClass: "fallback",
      operationsToRun: [],
      evidenceRequired: [],
      outputContract: [],
      reasonCodes: ["unknown_fallback"],
      confidence: "medium"
    });
  }

  private highRiskReason(input: string): string | undefined {
    if (/\b(approve|promote|auto approve|auto-approve|auto promote|auto-promote|self approve|self-approve)\b/.test(input)) {
      return "approval_or_promotion_request";
    }
    if (/\b(memory|eval|training|golden|policy|schema|mode)\b/.test(input) && /\b(approve|promote|apply|make real)\b/.test(input)) {
      return "durable_artifact_promotion_request";
    }
    if (/\b(enable|turn on|allow)\b/.test(input) && /\b(shell|filewrite|file write|git push|unrestricted tool|tool permission)\b/.test(input)) {
      return "tool_permission_expansion_request";
    }
    if (/\b(git push|merge|auto merge|auto-merge|push to github|external repo write|write to external repo)\b/.test(input)) {
      return "source_or_external_repo_mutation_request";
    }
    if (/\b(train|fine tune|fine-tune|autotrain|auto train|auto-train)\b/.test(input) && /\b(model|stax|dataset|data)\b/.test(input)) {
      return "training_or_finetune_request";
    }
    return undefined;
  }

  private deferredReason(input: string): string | undefined {
    if (/\b(stress test|red team|red-team)\b/.test(input)) return "lab_stress_deferred";
    if (/\b(unleash|unlesh|launch|start|run|go|let loose|kick off)\b/.test(input) && /\b(sandbox|sand box|lab|learning lab)\b/.test(input)) {
      return "lab_run_deferred";
    }
    if (/\b(run|start|do)\b/.test(input) && /\b(eval|evals|evaluation|regression|regressions)\b/.test(input)) {
      return "eval_run_deferred";
    }
    if (/\b(compare)\b/.test(input) && /\b(chatgpt|external|other answer|outside answer|plan)\b/.test(input)) {
      return "model_comparison_deferred";
    }
    if (/\b(codex prompt|make a prompt|write a prompt)\b/.test(input) && /\b(evidence|proof|next fix|from this)\b/.test(input)) {
      return "codex_prompt_generation_deferred";
    }
    return undefined;
  }

  private isJudgmentDigest(input: string): boolean {
    return (
      /\bwhat needs my judgment\b/.test(input) ||
      /\bwhat do i need to (review|approve|decide)\b/.test(input) ||
      /\b(show|give me|what is|what's)\b/.test(input) && /\b(review digest|judgment digest|human review|blocked items|review inbox)\b/.test(input)
    );
  }

  private isAuditLastProof(input: string): boolean {
    return (
      /\bwhat did the last (run|answer|response) prove\b/.test(input) ||
      /\bwhat proof did the last (run|answer|response) have\b/.test(input) ||
      /\baudit last\b/.test(input) && /\b(proof|evidence|verified)\b/.test(input) ||
      /\blast run proof\b/.test(input)
    );
  }

  private isAuditThisRepo(input: string): boolean {
    return /\baudit (this|current) (repo|repository|project|workspace)\b/.test(input);
  }

  private extractRepoQuestion(input: string, context: ChatIntentContext): { workspace?: string; objective: string; reasonCode: string } | undefined {
    const currentRepo = /\b(this|current) (repo|repository|project|workspace)\b/.test(input);
    const mentionedWorkspace = this.findMentionedWorkspace(input, context);
    if (
      /\bwhat tests? (exist|are there|are in|does).*\b(repo|repository|project|workspace)\b/.test(input) ||
      /\bwhat tests exist in this repo\b/.test(input) ||
      (/\bwhat tests?\b/.test(input) && mentionedWorkspace)
    ) {
      return {
        workspace: mentionedWorkspace,
        objective: "Inspect the target repo for test scripts and test files without running tests.",
        reasonCode: mentionedWorkspace ? "workspace_tests_question" : "repo_tests_question"
      };
    }
    if (/\bwhat (is|looks) risky\b/.test(input) && (/\b(repo|repository|project|workspace)\b/.test(input) || mentionedWorkspace)) {
      return {
        workspace: mentionedWorkspace,
        objective: "Inspect the target repo for read-only risk signals and missing evidence.",
        reasonCode: mentionedWorkspace ? "workspace_risk_question" : "repo_risk_question"
      };
    }
    if (/\b(biggest|main|largest|top)\b.*\b(operational problem|operating problem|workflow problem|repo problem|project problem)\b/.test(input)) {
      return {
        workspace: mentionedWorkspace,
        objective: "Identify the highest verified operating-state risk from read-only repo evidence.",
        reasonCode: mentionedWorkspace ? "workspace_operating_state_question" : "repo_operating_state_question"
      };
    }
    if (/\bfix (this|current) (repo|repository|project|workspace)\b/.test(input) || /\bfix it\b/.test(input) && currentRepo) {
      return {
        objective: "Audit and plan next allowed actions for the target repo without mutating it.",
        reasonCode: "repo_fix_request_no_mutation"
      };
    }
    const fixWorkspace = input.match(/\bfix\s+([a-z0-9_-]+)\b/);
    if (fixWorkspace?.[1]) {
      const workspace = this.matchKnownWorkspace(fixWorkspace[1], context);
      if (workspace) {
        return {
          workspace,
          objective: `Audit and plan next allowed actions for workspace ${workspace} without mutating it.`,
          reasonCode: "workspace_fix_request_no_mutation"
        };
      }
    }
    const testsWorkspace = input.match(/\bwhat tests (?:exist|are there|are in).*\b([a-z0-9_-]+)\b/);
    if (testsWorkspace?.[1]) {
      const workspace = this.matchKnownWorkspace(testsWorkspace[1], context);
      if (workspace) {
        return {
          workspace,
          objective: `Inspect workspace ${workspace} for test scripts and test files without running tests.`,
          reasonCode: "workspace_tests_question"
        };
      }
    }
    return undefined;
  }

  private extractAuditWorkspace(input: string, context: ChatIntentContext): string | undefined {
    const mentioned = this.findMentionedWorkspace(input, context);
    if (mentioned) return mentioned;

    const match = input.match(/\baudit\s+(?:workspace\s+|project\s+|repo\s+|repository\s+)?([a-z0-9_-]+)\b/);
    const raw = match?.[1]?.trim();
    if (!raw || /^(this|current|the|my|last|it|that)$/.test(raw)) return undefined;
    const exact = this.matchKnownWorkspace(raw, context);
    if (exact) return exact;
    return raw;
  }

  private extractCodexReportAuditWorkspace(input: string, context: ChatIntentContext): string | undefined {
    if (!/\baudit\b/.test(input) || !/\bcodex\b/.test(input) || !/\b(report|final report|claims?|says|said)\b/.test(input)) {
      return undefined;
    }
    return this.findMentionedWorkspace(input, context) ?? context.currentWorkspace;
  }

  private extractBoundedPromptWorkspace(input: string, context: ChatIntentContext): string | undefined {
    if (!/\b(create|make|write|generate)\b/.test(input) || !/\b(codex prompt|prompt for codex|bounded prompt)\b/.test(input)) {
      return undefined;
    }
    if (!/\b(repo evidence|current repo evidence|evidence|proof|bounded|one bounded|next patch|next fix)\b/.test(input)) {
      return undefined;
    }
    return this.findMentionedWorkspace(input, context) ?? context.currentWorkspace;
  }

  private matchKnownWorkspace(candidate: string, context: ChatIntentContext): string | undefined {
    const known = context.knownWorkspaces ?? [];
    return known.find((workspace) => workspace.toLowerCase() === candidate.toLowerCase());
  }

  private findMentionedWorkspace(input: string, context: ChatIntentContext): string | undefined {
    return (context.knownWorkspaces ?? []).find((workspace) => input.includes(workspace.toLowerCase()));
  }

  private plan(input: PlanInput): OperationPlan {
    return OperationPlanSchema.parse({
      operationId: `op_${createHash("sha256")
        .update(`${CHAT_OPERATOR_VERSION}:${input.originalInput}:${input.intent}:${input.executionClass}`)
        .digest("hex")
        .slice(0, 16)}`,
      operatorVersion: CHAT_OPERATOR_VERSION,
      operationsToRun: [],
      requiresConfirmation: input.executionClass === "requires_confirmation",
      evidenceRequired: [],
      outputContract: [],
      reasonCodes: [],
      confidence: "medium",
      ...input
    });
  }
}

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
