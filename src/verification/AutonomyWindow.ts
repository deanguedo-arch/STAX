import {
  AutonomyWindowSchema,
  type ParsedAutonomyWindow,
  type ParsedWorkPacket,
  type WorkPacket
} from "./VerificationEconomySchemas.js";

export class AutonomyWindowController {
  forPacket(packet: WorkPacket): ParsedAutonomyWindow {
    const parsed = packet.autonomyWindow
      ? AutonomyWindowSchema.parse(packet.autonomyWindow)
      : AutonomyWindowSchema.parse({
          mode: packet.mode ?? "plan_only",
          allowedCommands: packet.allowedCommands ?? [],
          allowedFileGlobs: packet.allowedFileGlobs ?? [],
          forbiddenFileGlobs: packet.forbiddenFileGlobs ?? [],
          hardBlockedCommands: packet.hardBlockedCommands ?? []
        });
    return parsed;
  }

  withApproval(packet: WorkPacket): ParsedAutonomyWindow {
    return AutonomyWindowSchema.parse({ ...this.forPacket(packet), humanApprovedWindow: true, mode: "sandbox_patch" });
  }

  isCommandAllowed(command: string, window: ParsedAutonomyWindow): boolean {
    return window.allowedCommands.some((allowed) => normalizeCommand(allowed) === normalizeCommand(command));
  }

  isCommandHardBlocked(command: string, window: ParsedAutonomyWindow): boolean {
    return window.hardBlockedCommands.some((blocked) => normalizeCommand(blocked) === normalizeCommand(command));
  }

  hasForbiddenFile(files: string[], window: ParsedAutonomyWindow): string | undefined {
    return files.find((file) => window.forbiddenFileGlobs.some((glob) => matchesGlob(file, glob)));
  }

  hasDisallowedFile(files: string[], window: ParsedAutonomyWindow): string | undefined {
    if (!files.length || !window.allowedFileGlobs.length) return undefined;
    return files.find((file) => !window.allowedFileGlobs.some((glob) => matchesGlob(file, glob)));
  }

  withinBudget(input: { touchedFiles: string[]; commandCount: number; microStepCount: number; window: ParsedAutonomyWindow }): boolean {
    return (
      new Set(input.touchedFiles).size <= input.window.maxTouchedFiles &&
      input.commandCount <= input.window.maxCommands &&
      input.microStepCount <= input.window.maxMicroSteps
    );
  }
}

export function matchesGlob(file: string, glob: string): boolean {
  const value = normalizePath(file);
  const pattern = normalizePath(glob);
  if (pattern.endsWith("/**")) {
    const prefix = pattern.slice(0, -3);
    return value === prefix || value.startsWith(`${prefix}/`);
  }
  if (!pattern.includes("*")) return value === pattern;
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "__DOUBLE_STAR__")
    .replace(/\*/g, "[^/]*")
    .replace(/__DOUBLE_STAR__/g, ".*");
  return new RegExp(`^${escaped}$`).test(value);
}

function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizePath(file: string): string {
  return file.trim().replace(/^\.?\//, "");
}

export function packetWindow(packet: ParsedWorkPacket): ParsedAutonomyWindow {
  return new AutonomyWindowController().forPacket(packet);
}
