import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ClosedLoopCodexLedger } from "./ClosedLoopCodexCampaign.js";

export const HumanJudgmentDecisionSchema = z.enum([
  "accepted",
  "accepted_after_patch",
  "rejected",
  "blocked_too_hard",
  "needs_followup"
]);

export const HumanJudgmentEntrySchema = z.object({
  judgmentId: z.string().min(1),
  sourceTaskId: z.string().min(1),
  repo: z.string().min(1),
  humanDecision: HumanJudgmentDecisionSchema,
  reason: z.string().min(1),
  cleanupPromptsObserved: z.number().int().min(0),
  usefulNextAction: z.boolean(),
  missingProofCaught: z.boolean(),
  blockedUnnecessarily: z.boolean(),
  evalCandidate: z.boolean(),
  promotedLesson: z.boolean(),
  promotionTarget: z.string().optional(),
  disagreementNote: z.string().optional()
});

export const HumanJudgmentLedgerSchema = z.object({
  campaignId: z.string().min(1),
  sourceLedger: z.string().min(1),
  entries: z.array(HumanJudgmentEntrySchema).min(1)
});

export type HumanJudgmentEntry = z.infer<typeof HumanJudgmentEntrySchema>;
export type HumanJudgmentLedger = z.infer<typeof HumanJudgmentLedgerSchema>;

export type HumanJudgmentSummary = {
  campaignId: string;
  requiredJudgments: number;
  recordedJudgments: number;
  acceptedCount: number;
  rejectedCount: number;
  blockedTooHardCount: number;
  followupCount: number;
  missingSourceTaskIds: string[];
  duplicateSourceTaskIds: string[];
  promotedWithoutTarget: string[];
  disagreementMissingTaskIds: string[];
  cleanupPromptsObservedMean: number | null;
  evalCandidateCount: number;
  status: "judgment_ready" | "blocked" | "invalid";
  blockers: string[];
};

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function isAccepted(decision: HumanJudgmentEntry["humanDecision"]): boolean {
  return decision === "accepted" || decision === "accepted_after_patch";
}

export function summarizeHumanJudgmentLedger(args: {
  ledger: HumanJudgmentLedger;
  closedLoopLedger: ClosedLoopCodexLedger;
}): HumanJudgmentSummary {
  const blockers: string[] = [];
  const taskIds = new Set(args.closedLoopLedger.tasks.map((task) => task.taskId));
  const seen = new Set<string>();
  const duplicateSourceTaskIds: string[] = [];
  const missingSourceTaskIds = args.closedLoopLedger.tasks
    .map((task) => task.taskId)
    .filter((taskId) => !args.ledger.entries.some((entry) => entry.sourceTaskId === taskId));

  const promotedWithoutTarget = args.ledger.entries
    .filter((entry) => entry.promotedLesson && !entry.promotionTarget?.trim())
    .map((entry) => entry.judgmentId);

  for (const entry of args.ledger.entries) {
    if (seen.has(entry.sourceTaskId)) duplicateSourceTaskIds.push(entry.sourceTaskId);
    seen.add(entry.sourceTaskId);
    if (!taskIds.has(entry.sourceTaskId)) duplicateSourceTaskIds.push(`${entry.sourceTaskId}:unknown_task`);
  }

  const disagreementMissingTaskIds = args.closedLoopLedger.tasks
    .filter((task) => task.falseAccept || task.falseBlock)
    .map((task) => task.taskId)
    .filter((taskId) => {
      const judgment = args.ledger.entries.find((entry) => entry.sourceTaskId === taskId);
      return !judgment?.disagreementNote?.trim();
    });

  if (missingSourceTaskIds.length > 0) blockers.push("one or more closed-loop tasks lack a human judgment record");
  if (duplicateSourceTaskIds.length > 0) blockers.push("duplicate or unknown sourceTaskId found in human judgment ledger");
  if (promotedWithoutTarget.length > 0) blockers.push("promoted lesson missing promotion target");
  if (disagreementMissingTaskIds.length > 0) blockers.push("false accept/block tasks require an explicit disagreement note");

  const acceptedCount = args.ledger.entries.filter((entry) => isAccepted(entry.humanDecision)).length;
  const rejectedCount = args.ledger.entries.filter((entry) => entry.humanDecision === "rejected").length;
  const blockedTooHardCount = args.ledger.entries.filter((entry) => entry.humanDecision === "blocked_too_hard").length;
  const followupCount = args.ledger.entries.filter((entry) => entry.humanDecision === "needs_followup").length;

  return {
    campaignId: args.ledger.campaignId,
    requiredJudgments: args.closedLoopLedger.tasks.length,
    recordedJudgments: args.ledger.entries.length,
    acceptedCount,
    rejectedCount,
    blockedTooHardCount,
    followupCount,
    missingSourceTaskIds,
    duplicateSourceTaskIds,
    promotedWithoutTarget,
    disagreementMissingTaskIds,
    cleanupPromptsObservedMean: mean(args.ledger.entries.map((entry) => entry.cleanupPromptsObserved)),
    evalCandidateCount: args.ledger.entries.filter((entry) => entry.evalCandidate).length,
    status:
      args.closedLoopLedger.tasks.length === 0
        ? "invalid"
        : blockers.length > 0
          ? "blocked"
          : "judgment_ready",
    blockers
  };
}

export function formatHumanJudgmentDigest(summary: HumanJudgmentSummary): string {
  return [
    "Human Judgment Digest",
    `- campaign: ${summary.campaignId}`,
    `- required judgments: ${summary.requiredJudgments}`,
    `- recorded judgments: ${summary.recordedJudgments}`,
    `- accepted: ${summary.acceptedCount}`,
    `- rejected: ${summary.rejectedCount}`,
    `- blocked too hard: ${summary.blockedTooHardCount}`,
    `- needs followup: ${summary.followupCount}`,
    `- eval candidates: ${summary.evalCandidateCount}`,
    `- cleanup prompts observed mean: ${summary.cleanupPromptsObservedMean ?? "n/a"}`,
    summary.missingSourceTaskIds.length
      ? `- missing judgments: ${summary.missingSourceTaskIds.join(", ")}`
      : "- missing judgments: none",
    summary.disagreementMissingTaskIds.length
      ? `- missing disagreement notes: ${summary.disagreementMissingTaskIds.join(", ")}`
      : "- missing disagreement notes: none",
    `- status: ${summary.status}`
  ].join("\n");
}

export async function validateHumanJudgmentLedger(input: {
  ledgerPath?: string;
  closedLoopLedgerPath?: string;
} = {}): Promise<{ ledgerPath: string; closedLoopLedgerPath: string; summary: HumanJudgmentSummary }> {
  const ledgerPath = input.ledgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "human_judgment_ledger.json");
  const closedLoopLedgerPath =
    input.closedLoopLedgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "closed_loop_20_tasks.json");
  const ledger = HumanJudgmentLedgerSchema.parse(JSON.parse(await fs.readFile(ledgerPath, "utf8")) as unknown);
  const closedLoopLedger = JSON.parse(await fs.readFile(closedLoopLedgerPath, "utf8")) as ClosedLoopCodexLedger;
  return {
    ledgerPath,
    closedLoopLedgerPath,
    summary: summarizeHumanJudgmentLedger({
      ledger,
      closedLoopLedger
    })
  };
}
