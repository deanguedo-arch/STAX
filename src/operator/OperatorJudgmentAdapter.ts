import { JudgmentPacketBuilder } from "../review/JudgmentPacket.js";
import type { OperationExecutionResult, OperationPlan } from "./OperationSchemas.js";

export function judgmentPacketFor(_plan: OperationPlan, result: OperationExecutionResult) {
  const hasPersistedCounts = /\b(human_review|hard_block|batch_review):\s*\d+/i.test(result.result);
  return new JudgmentPacketBuilder().build({
    decisionNeeded: "Decide whether to refresh persisted review metadata before acting on review items.",
    options: [
      "refresh review inbox",
      "defer action until fresh evidence",
      "read current digest only"
    ],
    recommendedOption: hasPersistedCounts ? "refresh review inbox" : "defer action until fresh evidence",
    evidenceAvailable: [
      ...result.evidenceChecked,
      hasPersistedCounts ? "persisted review counts" : undefined
    ].filter((item): item is string => Boolean(item)),
    evidenceMissing: hasPersistedCounts ? ["fresh review inbox output"] : ["persisted review counts", "fresh review inbox output"],
    riskIfApproved: "Refreshing review metadata can change queue state and should remain an explicit human-directed operation.",
    riskIfRejected: "The digest may be stale, so decisions could be delayed or based on older review state.",
    irreversible: false
  });
}
