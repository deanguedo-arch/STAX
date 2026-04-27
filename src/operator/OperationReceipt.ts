import { z } from "zod";
import {
  OperationExecutionClassSchema,
  OperationIntentSchema,
  OperationRiskLevelSchema,
  type OperationExecutionResult,
  type OperationPlan
} from "./OperationSchemas.js";

export const OperationReceiptClaimSchema = z.object({
  claim: z.string().min(1),
  evidenceRefs: z.array(z.string().min(1)).min(1)
});

export const OperationReceiptSchema = z.object({
  receiptId: z.string().min(1),
  createdAt: z.string().min(1),
  operationId: z.string().min(1),
  operatorVersion: z.string().min(1),
  intent: OperationIntentSchema,
  executionClass: OperationExecutionClassSchema,
  riskLevel: OperationRiskLevelSchema,
  status: z.enum(["executed", "blocked", "deferred", "not_executed"]),
  proofQuality: z.enum(["sufficient", "partial", "insufficient"]),
  promotionStatus: z.enum(["not_allowed", "not_requested", "blocked"]),
  mutationStatus: z.literal("none"),
  evidenceRequired: z.array(z.string()),
  evidenceChecked: z.array(z.string()),
  actionsRun: z.array(z.string()),
  artifactsCreated: z.array(z.string()),
  claimsVerified: z.array(OperationReceiptClaimSchema),
  claimsNotVerified: z.array(z.string()),
  missingEvidence: z.array(z.string()),
  fakeCompleteRisks: z.array(z.string()),
  nextAllowedActions: z.array(z.string())
});

export type OperationReceiptClaim = z.infer<typeof OperationReceiptClaimSchema>;
export type OperationReceipt = z.infer<typeof OperationReceiptSchema>;

export function buildOperationReceipt(plan: OperationPlan, result: OperationExecutionResult): OperationReceipt {
  return OperationReceiptSchema.parse({
    receiptId: `receipt_${plan.operationId}`,
    createdAt: new Date().toISOString(),
    operationId: plan.operationId,
    operatorVersion: plan.operatorVersion,
    intent: plan.intent,
    executionClass: plan.executionClass,
    riskLevel: plan.riskLevel,
    status: result.blocked ? "blocked" : result.deferred ? "deferred" : result.executed ? "executed" : "not_executed",
    proofQuality: proofQuality(plan, result),
    promotionStatus: result.blocked ? "blocked" : "not_allowed",
    mutationStatus: "none",
    evidenceRequired: plan.evidenceRequired,
    evidenceChecked: result.evidenceChecked,
    actionsRun: result.actionsRun,
    artifactsCreated: result.artifactsCreated,
    claimsVerified: verifiedClaims(plan, result),
    claimsNotVerified: notVerifiedClaims(plan, result),
    missingEvidence: missingEvidence(plan, result),
    fakeCompleteRisks: fakeCompleteRisks(plan, result),
    nextAllowedActions: result.nextAllowedActions
  });
}

export function renderOperationReceipt(receipt: OperationReceipt): string {
  return [
    "## Operation",
    `Operation: ${receipt.intent}`,
    `OperationId: ${receipt.operationId}`,
    `Receipt: ${receipt.receiptId}`,
    `OperatorVersion: ${receipt.operatorVersion}`,
    `ExecutionClass: ${receipt.executionClass}`,
    `Risk: ${receipt.riskLevel}`,
    `Status: ${receipt.status}`,
    `ProofQuality: ${receipt.proofQuality}`,
    `PromotionStatus: ${receipt.promotionStatus}`,
    `MutationStatus: ${receipt.mutationStatus}`,
    "",
    "## Evidence Required",
    ...list(receipt.evidenceRequired),
    "",
    "## Actions Run",
    ...list(receipt.actionsRun),
    "",
    "## Evidence Checked",
    ...list(receipt.evidenceChecked),
    "",
    "## Artifacts Created",
    ...list(receipt.artifactsCreated),
    "",
    "## Claims Verified",
    ...(receipt.claimsVerified.length
      ? receipt.claimsVerified.map((item) => `- ${item.claim} [evidence: ${item.evidenceRefs.join(", ")}]`)
      : ["- None"]),
    "",
    "## Claims Not Verified",
    ...list(receipt.claimsNotVerified),
    "",
    "## Missing Evidence",
    ...list(receipt.missingEvidence),
    "",
    "## Fake-Complete Risks",
    ...list(receipt.fakeCompleteRisks),
    "",
    "## Next Allowed Action",
    ...list(receipt.nextAllowedActions)
  ].join("\n");
}

function proofQuality(plan: OperationPlan, result: OperationExecutionResult): "sufficient" | "partial" | "insufficient" {
  if (result.blocked || result.deferred || !result.executed) return "insufficient";
  if (plan.intent === "judgment_digest") return "partial";
  if (result.artifactsCreated.some((item) => item.startsWith("runs/")) && result.evidenceChecked.some((item) => item.startsWith("repo:") || item === "trace.json")) {
    return "partial";
  }
  return result.evidenceChecked.length ? "partial" : "insufficient";
}

function verifiedClaims(plan: OperationPlan, result: OperationExecutionResult): OperationReceiptClaim[] {
  const claims: OperationReceiptClaim[] = [];
  const evidence = new Set(result.evidenceChecked);
  const actions = new Set(result.actionsRun);

  if (result.blocked) {
    claims.push({
      claim: "No operation action was executed because the risk gate blocked the request.",
      evidenceRefs: ["OperationRiskGate"]
    });
    return claims;
  }

  if (result.deferred) {
    claims.push({
      claim: "No operation action was executed because the request was deferred to an explicit slash or CLI path.",
      evidenceRefs: ["OperationRiskGate"]
    });
    return claims;
  }

  if (actions.has("ReviewQueue.list") && evidence.has("review/queue")) {
    claims.push({
      claim: "The persisted review queue was read without applying review actions.",
      evidenceRefs: ["review/queue"]
    });
  }

  const workspace = findEvidence(result, /^Workspace:/);
  const resolution = findEvidence(result, /^WorkspaceResolution:/);
  const repoPath = findEvidence(result, /^RepoPath:/);
  if (workspace && resolution && repoPath) {
    claims.push({
      claim: "The operation resolved a target workspace/repo scope.",
      evidenceRefs: [workspace, resolution, repoPath]
    });
  }

  const inspectedFiles = result.evidenceChecked.filter((item) => item.startsWith("repo:"));
  if (inspectedFiles.length) {
    claims.push({
      claim: "Repo files were inspected read-only.",
      evidenceRefs: inspectedFiles.slice(0, 12)
    });
  }

  const scripts = result.evidenceChecked.filter((item) => item.startsWith("repo-script:"));
  if (scripts.length) {
    claims.push({
      claim: "package.json scripts were extracted read-only.",
      evidenceRefs: scripts
    });
  }

  const tests = result.evidenceChecked.filter((item) => item.startsWith("repo-test:"));
  if (tests.length) {
    claims.push({
      claim: "Test files were enumerated read-only.",
      evidenceRefs: tests.slice(0, 12)
    });
  }

  if (result.artifactsCreated.some((item) => item.startsWith("runs/"))) {
    claims.push({
      claim: "A governed STAX audit run artifact was created.",
      evidenceRefs: result.artifactsCreated.filter((item) => item.startsWith("runs/"))
    });
  }

  if (evidence.has("last chat-linked run")) {
    claims.push({
      claim: "The proof audit was scoped to the current thread's last chat-linked run.",
      evidenceRefs: ["last chat-linked run"]
    });
  }

  if (evidence.has("trace.json")) {
    claims.push({
      claim: "Trace evidence was checked for the last-run proof audit.",
      evidenceRefs: ["trace.json"]
    });
  }

  if (plan.intent === "audit_workspace" || plan.intent === "workspace_repo_audit") {
    claims.push({
      claim: "No source files were modified by the Chat Operator operation.",
      evidenceRefs: ["OperationRiskGate", "RepoEvidencePack.build"]
    });
  }

  return dedupeClaims(claims);
}

function notVerifiedClaims(plan: OperationPlan, result: OperationExecutionResult): string[] {
  const claims = new Set<string>();
  const foundTestsOrScripts = result.evidenceChecked.some((item) => item.startsWith("repo-test:") || item.startsWith("repo-script:"));
  const createdAuditRun = result.artifactsCreated.some((item) => item.startsWith("runs/"));

  if (result.blocked || result.deferred || !result.executed) {
    claims.add("The requested operation was not completed or applied.");
  }
  if (foundTestsOrScripts) {
    claims.add("Tests were found, but no test command was executed by this operator; pass/fail is unknown.");
    claims.add("Test presence does not verify coverage or runtime behavior.");
  }
  if (plan.intent === "audit_workspace" || plan.intent === "workspace_repo_audit") {
    claims.add("Source behavior was not executed.");
    claims.add("Linked repo tests were not run.");
    claims.add("The audit did not approve, promote, merge, train, or modify durable system state.");
  }
  if (createdAuditRun) {
    claims.add("The created audit run is evidence of an audit, not evidence that the audited project is complete.");
  }
  if (plan.intent === "judgment_digest") {
    claims.add("The digest did not refresh, apply, approve, reject, archive, or promote review items.");
  }
  if (plan.intent === "audit_last_proof") {
    claims.add("The last-run proof audit does not prove broader repo correctness without command/eval evidence.");
  }
  return Array.from(claims);
}

function fakeCompleteRisks(plan: OperationPlan, result: OperationExecutionResult): string[] {
  const risks = new Set<string>();
  const foundTestsOrScripts = result.evidenceChecked.some((item) => item.startsWith("repo-test:") || item.startsWith("repo-script:"));
  if (foundTestsOrScripts) {
    risks.add("Finding test scripts or test files does not prove tests pass.");
    risks.add("A repo evidence pack can list files without proving behavior.");
  }
  if (result.artifactsCreated.some((item) => item.startsWith("runs/"))) {
    risks.add("A trace/run artifact proves STAX ran, not that the underlying task is solved.");
  }
  if (result.blocked || result.deferred || !result.executed) {
    risks.add("A blocked or deferred receipt proves no action happened; it is not task completion.");
  }
  if (plan.intent === "judgment_digest") {
    risks.add("A persisted review queue may be stale until an explicit refresh command is run.");
  }
  if (plan.intent === "audit_workspace" || plan.intent === "workspace_repo_audit") {
    risks.add("Read-only repo inspection can miss dynamic/runtime failures.");
  }
  return Array.from(risks);
}

function missingEvidence(plan: OperationPlan, result: OperationExecutionResult): string[] {
  const missing = new Set<string>();
  const foundTestsOrScripts = result.evidenceChecked.some((item) => item.startsWith("repo-test:") || item.startsWith("repo-script:"));
  if (foundTestsOrScripts) {
    missing.add("Local command output for test/typecheck pass or fail.");
  }
  if (plan.intent === "audit_workspace" || plan.intent === "workspace_repo_audit") {
    missing.add("Runtime execution evidence for source behavior.");
    missing.add("Human approval reason for any promotion or source mutation.");
  }
  if (plan.intent === "audit_last_proof") {
    missing.add("Fresh command/eval evidence for claims beyond the selected run and trace.");
  }
  if (result.blocked || result.deferred || !result.executed) {
    missing.add("Explicit future command or approval path before execution.");
  }
  return Array.from(missing);
}

function findEvidence(result: OperationExecutionResult, pattern: RegExp): string | undefined {
  return result.evidenceChecked.find((item) => pattern.test(item));
}

function dedupeClaims(claims: OperationReceiptClaim[]): OperationReceiptClaim[] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    const key = `${claim.claim}:${claim.evidenceRefs.join("|")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function list(items: string[]): string[] {
  return items.length ? items.map((item) => `- ${item}`) : ["- None"];
}
