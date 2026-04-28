import { AutonomyWindowController } from "./AutonomyWindow.js";
import {
  CheckpointGateInputSchema,
  CheckpointGateResultSchema,
  type CheckpointCommandEvidence,
  type CheckpointGateInput,
  type CheckpointGateResult
} from "./VerificationEconomySchemas.js";

export class CheckpointGate {
  evaluate(input: CheckpointGateInput): CheckpointGateResult {
    const parsed = CheckpointGateInputSchema.parse(input);
    const controller = new AutonomyWindowController();
    const window = controller.forPacket(parsed.packet);
    const command = parsed.command;

    if (command && controller.isCommandHardBlocked(command, window)) {
      return CheckpointGateResultSchema.parse({
        decision: "hard_stop",
        verificationTier: "tier_4_human_judgment",
        verificationRequiredNow: false,
        reasons: [`${command} is hard-blocked for this packet.`]
      });
    }

    if (command && !controller.isCommandAllowed(command, window)) {
      return CheckpointGateResultSchema.parse({
        decision: "hard_stop",
        verificationTier: "tier_4_human_judgment",
        verificationRequiredNow: false,
        reasons: [`${command} is not allowlisted for this packet.`]
      });
    }

    if (command === "npm run ingest:ci" && !hasPassingCommand(parsed.completedCommands, "npm run build")) {
      return CheckpointGateResultSchema.parse({
        decision: "checkpoint_required",
        verificationTier: "tier_3_full_gate",
        verificationRequiredNow: true,
        nextCheckpoint: "Run and record npm run build before npm run ingest:ci.",
        reasons: ["npm run build must pass before npm run ingest:ci can verify the packet goal."]
      });
    }

    if (parsed.exitCode !== undefined && parsed.exitCode !== 0) {
      return CheckpointGateResultSchema.parse({
        decision: "checkpoint_required",
        verificationTier: "tier_3_full_gate",
        verificationRequiredNow: true,
        firstRemainingFailure: `${command ?? "checkpoint command"} failed with exit code ${parsed.exitCode}.`,
        nextCheckpoint: "Report the first remaining failure before continuing.",
        reasons: ["Failed command becomes the packet checkpoint; do not continue as verified."]
      });
    }

    const completed = command && parsed.exitCode === 0
      ? [...parsed.completedCommands, { command, exitCode: parsed.exitCode }]
      : parsed.completedCommands;
    if (hasPassingCommand(completed, "npm run build") && hasPassingCommand(completed, "npm run ingest:ci")) {
      return CheckpointGateResultSchema.parse({
        decision: "done",
        verificationTier: "tier_3_full_gate",
        verificationRequiredNow: true,
        reasons: ["Build and ingest:ci passed; packet goal is verified."]
      });
    }

    return CheckpointGateResultSchema.parse({
      decision: "checkpoint_required",
      verificationTier: command && command.includes("ingest:ci") ? "tier_3_full_gate" : "tier_2_targeted_command",
      verificationRequiredNow: true,
      nextCheckpoint: nextCheckpoint(parsed.completedCommands, command),
      reasons: ["Record scoped proof before continuing."]
    });
  }
}

function hasPassingCommand(commands: CheckpointCommandEvidence[], expected: string): boolean {
  return commands.some((item) => normalizeCommand(item.command) === normalizeCommand(expected) && item.exitCode === 0);
}

function nextCheckpoint(commands: CheckpointCommandEvidence[], command?: string): string {
  if (command) return `Record proof for ${command}.`;
  if (!hasPassingCommand(commands, "npm run build")) return "Run and record npm run build.";
  return "Run and record npm run ingest:ci.";
}

function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, " ").toLowerCase();
}
