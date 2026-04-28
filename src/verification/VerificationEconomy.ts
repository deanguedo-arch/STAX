import { AutoAdvanceGate } from "./AutoAdvanceGate.js";
import {
  AutoAdvanceReportSchema,
  WorkPacketSchema,
  type AutoAdvanceGateResult,
  type AutoAdvanceReport,
  type ParsedWorkPacket,
  type WorkPacket
} from "./VerificationEconomySchemas.js";

export class VerificationEconomy {
  evaluatePacket(packet: WorkPacket): AutoAdvanceGateResult[] {
    const parsed = WorkPacketSchema.parse(packet);
    const gate = new AutoAdvanceGate();
    return parsed.autoContinueSteps.map((step, index) =>
      gate.evaluate({
        packet: parsed,
        step,
        completedSteps: parsed.autoContinueSteps.slice(0, index)
      })
    );
  }

  buildReport(packet: WorkPacket): AutoAdvanceReport {
    const parsed = WorkPacketSchema.parse(packet);
    const decisions = this.evaluatePacket(parsed);
    const autoAdvanced = parsed.autoContinueSteps
      .filter((_, index) => decisions[index]?.decision === "auto_continue")
      .map((step) => sentenceCase(step.description));
    const firstBoundary = parsed.approvalRequiredSteps[0]?.description ?? "No approval boundary found.";
    return AutoAdvanceReportSchema.parse({
      packetId: parsed.packetId,
      autoAdvanced,
      firstRealBoundary: `Approval required: ${firstBoundary}.`,
      proposedAuthorizedWindow: {
        allowedCommands: parsed.allowedCommands,
        allowedFiles: parsed.allowedFileGlobs,
        allowedAfterApproval: parsed.allowedAfterApproval
      },
      hardStops: parsed.hardStops.length ? parsed.hardStops : parsed.stopConditions,
      decisionNeeded: "Approve this bounded sandbox window, or stop here."
    });
  }

  formatReport(packet: WorkPacket): string {
    return formatAutoAdvanceReport(this.buildReport(packet), WorkPacketSchema.parse(packet));
  }
}

export function formatAutoAdvanceReport(report: AutoAdvanceReport, packet?: ParsedWorkPacket): string {
  return [
    "## Auto-Advanced",
    ...list(report.autoAdvanced),
    "",
    "## First Real Boundary",
    report.firstRealBoundary,
    "",
    "## Proposed Authorized Window",
    "Allowed commands:",
    ...list(report.proposedAuthorizedWindow.allowedCommands),
    "",
    "Allowed files:",
    ...list(report.proposedAuthorizedWindow.allowedFiles),
    ...(report.proposedAuthorizedWindow.allowedAfterApproval.length
      ? ["", "Allowed after approval:", ...list(report.proposedAuthorizedWindow.allowedAfterApproval)]
      : []),
    "",
    "## Hard Stops",
    ...list(report.hardStops),
    ...(packet?.stopConditions.length ? ["", "Stop conditions:", ...list(packet.stopConditions)] : []),
    "",
    "## Decision Needed",
    report.decisionNeeded
  ].join("\n");
}

function list(items: string[]): string[] {
  return items.length ? items.map((item) => `- ${item}`) : ["- None"];
}

function sentenceCase(text: string): string {
  return text ? `${text[0].toUpperCase()}${text.slice(1)}.` : text;
}
