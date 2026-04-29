import {
  WorkPacketSchema,
  type ParsedWorkPacket,
  type WorkPacket
} from "./VerificationEconomySchemas.js";

export class WorkPacketPlanner {
  plan(input: { goal: string; workspace?: string; repoPath?: string }): ParsedWorkPacket {
    if (isBrightspaceRollupGoal(`${input.goal}\n${input.workspace ?? ""}`)) {
      return this.brightspaceRollupInstallIntegrityPacket(input);
    }
    return WorkPacketSchema.parse({
      packetId: "bounded_safe_next_step",
      macroGoal: input.goal,
      workspace: input.workspace,
      repoPath: input.repoPath,
      autoContinueSteps: [
        { id: "inspect_evidence", description: "inspect existing evidence", kind: "read_only_inspection" },
        { id: "classify_boundary", description: "classify proof and authority boundary", kind: "evidence_classification" },
        { id: "draft_packet", description: "draft bounded next-step packet", kind: "prompt_drafting" }
      ],
      approvalRequiredSteps: [
        { id: "source_mutation", description: "source or durable-state mutation", kind: "human_judgment" }
      ],
      allowedCommands: [],
      allowedFileGlobs: [],
      forbiddenFileGlobs: ["fixtures/**", "gold/**", "benchmarks/**"],
      hardBlockedCommands: ["git push", "git reset --hard"],
      hardStops: ["fixture/gold mutation", "promotion", "real repo mutation without approval"]
    } satisfies WorkPacket);
  }

  brightspaceRollupInstallIntegrityPacket(input: { workspace?: string; repoPath?: string; goal?: string } = {}): ParsedWorkPacket {
    return WorkPacketSchema.parse({
      packetId: "repair_rollup_install_integrity",
      macroGoal: input.goal ?? "Repair only the missing Rollup native optional package on darwin arm64.",
      workspace: input.workspace ?? "brightspacequizexporter",
      repoPath: input.repoPath,
      mode: "plan_only",
      autoContinueSteps: [
        { id: "inspect_existing_evidence", description: "inspect existing evidence", kind: "read_only_inspection" },
        { id: "classify_dependency_blocker", description: "classify dependency/install blocker", kind: "evidence_classification" },
        { id: "inspect_package_metadata", description: "inspect scripts/package metadata", kind: "read_only_inspection" },
        { id: "check_allowed_boundaries", description: "check allowed files/commands", kind: "structural_check" },
        { id: "draft_bounded_prompt", description: "draft bounded Codex repair prompt", kind: "prompt_drafting" },
        { id: "summarize_packet", description: "summarize packet boundaries", kind: "summary" }
      ],
      approvalRequiredSteps: [
        { id: "dependency_repair", description: "dependency repair", kind: "dependency_repair", files: ["package-lock.json"] },
        { id: "sandbox_patching", description: "sandbox patching", kind: "sandbox_patching" },
        { id: "package_lock_mutation", description: "package-lock mutation", kind: "file_mutation", files: ["package-lock.json"] },
        { id: "package_json_mutation", description: "package.json mutation", kind: "file_mutation", files: ["package.json"] }
      ],
      allowedAfterApproval: [
        "npm ls @rollup/rollup-darwin-arm64 rollup vite",
        "repair package-lock/package.json only if needed",
        "preserve/resolve tmp/.gitkeep",
        "npm run build",
        "npm run ingest:ci"
      ],
      allowedCommands: [
        "npm ls @rollup/rollup-darwin-arm64 rollup vite",
        "npm run build",
        "npm run ingest:ci"
      ],
      allowedFileGlobs: ["package-lock.json", "package.json", "tmp/.gitkeep"],
      forbiddenFileGlobs: ["src/**", "scripts/**", "fixtures/**", "gold/**", "benchmarks/**", "reviewed-fixtures/**", "reviewed_fixtures/**"],
      hardBlockedCommands: ["npm run ingest:seed-gold", "npm install --force", "git push", "git reset --hard"],
      hardStops: [
        "src/**",
        "scripts/**",
        "fixtures/**",
        "gold/**",
        "benchmarks/**",
        "reviewed fixtures",
        "ingest:seed-gold",
        "npm install --force",
        "git push",
        "git reset --hard",
        "package-lock deletion without approval"
      ],
      checkpointCommands: [
        "npm ls @rollup/rollup-darwin-arm64 rollup vite",
        "npm run build",
        "npm run ingest:ci"
      ],
      stopConditions: [
        "forbidden file touched",
        "non-allowlisted command needed",
        "command fails",
        "broader repair required",
        "goal verified"
      ],
      autonomyWindow: {
        mode: "plan_only",
        humanApprovedWindow: false,
        maxMicroSteps: 10,
        maxTouchedFiles: 2,
        maxCommands: 4,
        maxConsecutiveFailures: 1,
        allowedCommands: [
          "npm ls @rollup/rollup-darwin-arm64 rollup vite",
          "npm run build",
          "npm run ingest:ci"
        ],
        allowedFileGlobs: ["package-lock.json", "package.json", "tmp/.gitkeep"],
        forbiddenFileGlobs: ["src/**", "scripts/**", "fixtures/**", "gold/**", "benchmarks/**", "reviewed-fixtures/**", "reviewed_fixtures/**"],
        hardBlockedCommands: ["npm run ingest:seed-gold", "npm install --force", "git push", "git reset --hard"],
        checkpointRequiredAfter: ["file_change", "failed_command", "max_micro_steps", "goal_verified"]
      }
    } satisfies WorkPacket);
  }
}

function isBrightspaceRollupGoal(text: string): boolean {
  return /\b(brightspacequizexporter|rollup|@rollup\/rollup-darwin-arm64|darwin arm64|darwin-arm64|dependency|install)\b/i.test(text) &&
    /\b(ingest:ci|build|optional package|optional dependency|native|package-lock)\b/i.test(text);
}
