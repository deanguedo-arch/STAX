import { describe, expect, it } from "vitest";
import { AutoAdvanceGate } from "../src/verification/AutoAdvanceGate.js";
import { CheckpointGate } from "../src/verification/CheckpointGate.js";
import { AutonomyWindowController } from "../src/verification/AutonomyWindow.js";
import { VerificationEconomy } from "../src/verification/VerificationEconomy.js";
import { WorkPacketPlanner } from "../src/verification/WorkPacketPlanner.js";

describe("Auto-Advance With Hard Stops", () => {
  const planner = new WorkPacketPlanner();
  const packet = planner.brightspaceRollupInstallIntegrityPacket({
    repoPath: "/Users/deanguedo/Documents/GitHub/brightspacequizexporter"
  });
  const gate = new AutoAdvanceGate();
  const checkpoint = new CheckpointGate();

  it("lets safe read-only micro-steps auto-continue", () => {
    for (const step of packet.autoContinueSteps.slice(0, 4)) {
      const result = gate.evaluate({ packet, step });

      expect(result.decision).toBe("auto_continue");
      expect(result.requiresHumanNow).toBe(false);
    }
  });

  it("summarizes safe micro-steps without asking Dean for separate approvals", () => {
    const report = new VerificationEconomy().formatReport(packet);

    expect(report).toContain("## Auto-Advanced");
    expect(report).toContain("- Inspect existing evidence.");
    expect(report).toContain("- Classify dependency/install blocker.");
    expect(report).toContain("## First Real Boundary");
    expect(report).toContain("Approval required: dependency repair.");
    expect(report).toContain("## Decision Needed");
    expect(report).toContain("Approve this bounded sandbox window, or stop here.");
    expect(report).not.toContain("Can I inspect");
    expect(report).not.toContain("Can I classify");
    expect(report).not.toContain("Can I check package-lock");
    expect(report).not.toContain("Can I draft");
  });

  it("requires approval before package-lock or package.json mutation", () => {
    const packageLock = gate.evaluate({
      packet,
      step: { id: "patch_lock", description: "patch package-lock.json", kind: "file_mutation", files: ["package-lock.json"] }
    });
    const packageJson = gate.evaluate({
      packet,
      step: { id: "patch_package", description: "patch package.json", kind: "file_mutation", files: ["package.json"] }
    });

    expect(packageLock.decision).toBe("approval_required");
    expect(packageJson.decision).toBe("approval_required");
  });

  it("turns approved allowed mutation into checkpoint_required instead of auto_continue", () => {
    const window = new AutonomyWindowController().withApproval(packet);
    const result = gate.evaluate({
      packet,
      window,
      step: { id: "patch_lock", description: "patch package-lock.json", kind: "file_mutation", files: ["package-lock.json"] }
    });

    expect(result.decision).toBe("checkpoint_required");
    expect(result.verificationRequiredNow).toBe(true);
    expect(result.requiresHumanNow).toBe(false);
  });

  it("hard-stops forbidden file globs", () => {
    for (const file of ["src/parser.ts", "scripts/ingest-promotion-check.mjs", "fixtures/reviewed.json", "gold/case.json", "benchmarks/run.json"]) {
      const result = gate.evaluate({
        packet,
        step: { id: `touch_${file}`, description: `touch ${file}`, kind: "file_mutation", files: [file] }
      });

      expect(result.decision).toBe("hard_stop");
      expect(result.hardStopReason).toContain(file.split("/")[0]);
    }
  });

  it("hard-stops hard-blocked commands", () => {
    for (const command of ["npm run ingest:seed-gold", "npm install --force"]) {
      const result = gate.evaluate({
        packet,
        step: { id: command, description: command, kind: "targeted_command", command }
      });

      expect(result.decision).toBe("hard_stop");
      expect(result.hardStopReason).toContain(command);
    }
  });

  it("returns checkpoint_required with first remaining failure for failed ingest:ci", () => {
    const result = checkpoint.evaluate({
      packet,
      command: "npm run ingest:ci",
      exitCode: 1,
      completedCommands: [{ command: "npm run build", exitCode: 0 }]
    });

    expect(result.decision).toBe("checkpoint_required");
    expect(result.firstRemainingFailure).toContain("npm run ingest:ci failed");
  });

  it("requires build before ingest:ci can verify the packet goal", () => {
    const result = checkpoint.evaluate({ packet, command: "npm run ingest:ci", exitCode: 0 });

    expect(result.decision).toBe("checkpoint_required");
    expect(result.nextCheckpoint).toContain("npm run build");
  });

  it("returns done after build and ingest:ci pass", () => {
    const result = checkpoint.evaluate({
      packet,
      command: "npm run ingest:ci",
      exitCode: 0,
      completedCommands: [{ command: "npm run build", exitCode: 0 }]
    });

    expect(result.decision).toBe("done");
  });

  it("stops repeated same micro-step three times", () => {
    const repeated = { id: "inspect_existing_evidence", description: "inspect existing evidence", kind: "read_only_inspection" as const };
    const result = gate.evaluate({
      packet,
      step: repeated,
      completedSteps: [repeated, repeated]
    });

    expect(result.decision).toBe("hard_stop");
    expect(result.hardStopReason).toContain("Repeated same micro-step");
  });

  it("never represents v0 as execution or mutation", () => {
    const report = new VerificationEconomy().buildReport(packet);

    expect(report.decisionNeeded).toContain("Approve this bounded sandbox window");
    expect(report.autoAdvanced).toHaveLength(6);
    expect(report.proposedAuthorizedWindow.allowedCommands).toContain("npm run build");
    expect(report.proposedAuthorizedWindow.allowedCommands).toContain("npm run ingest:ci");
  });
});
