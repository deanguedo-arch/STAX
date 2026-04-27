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

    const deferred = this.deferredReason(normalized);
    if (deferred) {
      return this.plan({
        intent: "unknown",
        originalInput,
        objective: "Defer a broad or artifact-heavy natural-language operation outside Chat Operator v1A.",
        riskLevel: "medium",
        executionClass: "review_only",
        operationsToRun: [],
        evidenceRequired: ["OperationPlan"],
        outputContract: ["state deferred scope", "name slash or CLI power tool", "state no action executed"],
        reasonCodes: [deferred, "deferred_outside_v1a"],
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
        operationsToRun: ["WorkspaceContext.resolve", "collectLocalEvidence", "RepoSummary.summarize", "RaxRuntime.run codex_audit"],
        evidenceRequired: ["workspace registry or current repo", "repo summary", "local evidence", "codex_audit run"],
        outputContract: ["operation plan", "evidence checked", "claims verified", "claims not verified", "risks", "next allowed action"],
        reasonCodes: ["audit_workspace_intent"],
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
        operationsToRun: ["WorkspaceContext.resolve", "collectLocalEvidence", "RepoSummary.summarize", "RaxRuntime.run codex_audit"],
        evidenceRequired: ["workspace registry or current repo", "repo summary", "local evidence", "codex_audit run"],
        outputContract: ["operation plan", "evidence checked", "claims verified", "claims not verified", "risks", "next allowed action"],
        reasonCodes: ["audit_workspace_intent"],
        confidence: "high"
      });
    }

    return this.plan({
      intent: "unknown",
      originalInput,
      objective: "No Chat Operator v1A control intent detected; use normal runtime fallback.",
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

  private extractAuditWorkspace(input: string, context: ChatIntentContext): string | undefined {
    const match = input.match(/\baudit\s+(?:workspace\s+|project\s+|repo\s+|repository\s+)?([a-z0-9_-]+(?:\s+[a-z0-9_-]+){0,2})\b/);
    const raw = match?.[1]?.trim();
    if (!raw || /^(this|current|the|my|last|it|that)$/.test(raw)) return undefined;
    const candidate = raw.replace(/\s+/g, "-");
    const known = context.knownWorkspaces ?? [];
    const exact = known.find((workspace) => workspace.toLowerCase() === candidate);
    if (exact) return exact;
    return candidate;
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
