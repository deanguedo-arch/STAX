import type { LearningEvent, LearningFailureType, LearningQueueType } from "./LearningEvent.js";

export class LearningClassifier {
  classify(event: LearningEvent): LearningQueueType[] {
    const queues = new Set<LearningQueueType>();
    const failures = new Set<LearningFailureType>(event.failureClassification.failureTypes);

    if (!event.failureClassification.hasFailure && event.output.finalStatus === "success") {
      queues.add("trace_only");
    }

    if (failures.has("critic_failure")) {
      queues.add("correction_candidate");
      queues.add("eval_candidate");
    }

    if (failures.has("schema_failure")) {
      queues.add("schema_patch_candidate");
      queues.add("eval_candidate");
    }

    if (
      failures.has("generic_output") ||
      failures.has("weak_plan") ||
      failures.has("missing_specificity")
    ) {
      queues.add("eval_candidate");
      queues.add("mode_contract_patch_candidate");
      queues.add("codex_prompt_candidate");
    }

    if (failures.has("eval_gap")) {
      queues.add("eval_candidate");
      queues.add("codex_prompt_candidate");
    }

    if (failures.has("eval_failure")) {
      queues.add("eval_candidate");
      queues.add("policy_patch_candidate");
    }

    if (failures.has("replay_drift")) {
      queues.add("eval_candidate");
      queues.add("policy_patch_candidate");
    }

    if (failures.has("correction_needed")) {
      queues.add("correction_candidate");
      queues.add("training_candidate");
    }

    if (failures.has("memory_gap")) {
      queues.add("memory_candidate");
    }

    if (failures.has("policy_gap") || failures.has("mode_mismatch")) {
      queues.add("policy_patch_candidate");
      queues.add("eval_candidate");
    }

    if (failures.has("provider_role_mismatch")) {
      queues.add("policy_patch_candidate");
      queues.add("eval_candidate");
    }

    if (failures.has("command_failure")) {
      queues.add("eval_candidate");
      queues.add("policy_patch_candidate");
    }

    if (failures.has("promotion_failure")) {
      queues.add("correction_candidate");
      queues.add("eval_candidate");
    }

    if (queues.size === 0) queues.add("trace_only");
    return Array.from(queues);
  }
}
