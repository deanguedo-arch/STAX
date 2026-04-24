export type ConflictResolution = {
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
      conflicts.push({
        conflict: "User requested assumptions while evidence policy forbids unsupported claims.",
        higherPriorityRule: "evidence_policy"
      });
    }

    return {
      policies: uniquePolicies,
      conflicts
    };
  }
}
