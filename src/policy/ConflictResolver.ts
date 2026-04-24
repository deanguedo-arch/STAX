export type ConflictResolution = {
  conflictDetected: boolean;
  higherPriorityRule?: string;
  resolution?: string;
  affectedPolicies: string[];
  policies: string[];
  conflicts: Array<{
    conflict: string;
    higherPriorityRule: string;
  }>;
};

export class ConflictResolver {
  resolve(policies: string[], userInput = ""): string[] {
    return this.resolveWithConflicts(policies, userInput).policies;
  }

  resolveWithConflicts(policies: string[], userInput = ""): ConflictResolution {
    const uniquePolicies = [...new Set(policies)];
    const conflicts: ConflictResolution["conflicts"] = [];
    const lowerInput = userInput.toLowerCase();

    if (
      uniquePolicies.includes("evidence_policy") &&
      (lowerInput.includes("assume") ||
        lowerInput.includes("make assumptions") ||
        lowerInput.includes("fill in the blanks"))
    ) {
      const conflict = {
        conflict: "User requested assumptions while evidence policy forbids unsupported claims.",
        higherPriorityRule: "evidence_policy"
      };
      conflicts.push(conflict);
    }

    if (
      uniquePolicies.includes("safety_policy") &&
      (lowerInput.includes("step by step") || lowerInput.includes("exact instructions"))
    ) {
      conflicts.push({
        conflict: "User requested direct/actionable detail while safety policy may limit detail.",
        higherPriorityRule: "safety_policy"
      });
    }

    if (uniquePolicies.includes("memory_policy") && lowerInput.includes("remember this raw output")) {
      conflicts.push({
        conflict: "User requested memory persistence for raw output while memory policy requires approval.",
        higherPriorityRule: "memory_policy"
      });
    }

    if (uniquePolicies.includes("tool_policy") && lowerInput.includes("bypass tool")) {
      conflicts.push({
        conflict: "User requested tool policy bypass.",
        higherPriorityRule: "tool_policy"
      });
    }

    return {
      conflictDetected: conflicts.length > 0,
      higherPriorityRule: conflicts[0]?.higherPriorityRule,
      resolution: conflicts.length
        ? `Apply ${conflicts[0]?.higherPriorityRule} and continue with the safest useful version.`
        : undefined,
      affectedPolicies: conflicts.map((conflict) => conflict.higherPriorityRule),
      policies: uniquePolicies,
      conflicts
    };
  }
}
