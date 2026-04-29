import { HumanApplyPacketBuilder } from "../execution/HumanApplyPacket.js";
import { SandboxCommandWindow, type SandboxCommandRunner } from "./SandboxCommandWindow.js";
import { SandboxGuard } from "./SandboxGuard.js";
import { SandboxPatchWindow } from "./SandboxPatchWindow.js";
import {
  PatchProofChainInputSchema,
  PatchProofChainResultSchema,
  type PatchProofChainInput,
  type PatchProofChainResult,
  type PatchProofChainStatus
} from "./PatchProofChainSchemas.js";
import type { SandboxCommandWindowResult } from "./SandboxCommandWindowSchemas.js";
import type { SandboxPatchWindowResult } from "./SandboxPatchWindowSchemas.js";

export class PatchProofChain {
  constructor(
    private rootDir = process.cwd(),
    private runner?: SandboxCommandRunner
  ) {}

  async run(input: PatchProofChainInput): Promise<PatchProofChainResult> {
    const parsed = PatchProofChainInputSchema.parse(input);
    const guard = new SandboxGuard();
    const verifiedBefore = await guard.verify({
      workspace: parsed.workspace,
      packetId: parsed.packet.packetId,
      sourceRepoPath: parsed.linkedRepoPath,
      sandboxPath: parsed.sandboxPath
    });
    if (!verifiedBefore.allowedForCommandWindow) {
      return this.result({
        status: "blocked",
        parsed,
        blockingReasons: [`Sandbox manifest must verify before proof chain: ${verifiedBefore.blockingReasons.join("; ")}`],
        summary: "Patch proof chain blocked before patching or commands."
      });
    }

    let patchResult: SandboxPatchWindowResult | undefined;
    if (parsed.operations.length) {
      patchResult = await new SandboxPatchWindow(this.rootDir).run({
        packet: parsed.packet,
        operations: parsed.operations,
        humanApprovedPatch: parsed.humanApprovedPatch,
        sandboxPath: parsed.sandboxPath,
        linkedRepoPath: parsed.linkedRepoPath,
        workspace: parsed.workspace
      });
      if (patchResult.status !== "patched") {
        return this.result({
          status: "blocked",
          parsed,
          patchResult,
          blockingReasons: patchResult.blockingReasons,
          summary: "Patch proof chain blocked because sandbox patch did not complete."
        });
      }

      const verifiedAfter = await guard.verify({
        workspace: parsed.workspace,
        packetId: parsed.packet.packetId,
        sourceRepoPath: parsed.linkedRepoPath,
        sandboxPath: parsed.sandboxPath
      });
      if (!verifiedAfter.allowedForCommandWindow) {
        return this.result({
          status: "blocked",
          parsed,
          patchResult,
          blockingReasons: [`Post-patch sandbox manifest did not verify: ${verifiedAfter.blockingReasons.join("; ")}`],
          summary: "Patch proof chain blocked before commands because post-patch integrity failed."
        });
      }
    }

    const commandWindow = await new SandboxCommandWindow(this.rootDir, this.runner).run({
      packet: parsed.packet,
      commands: parsed.commands ?? parsed.packet.checkpointCommands,
      humanApprovedWindow: parsed.humanApprovedCommandWindow,
      execute: parsed.execute,
      sandboxPath: parsed.sandboxPath,
      linkedRepoPath: parsed.linkedRepoPath,
      workspace: parsed.workspace,
      completedCommands: parsed.completedCommands
    });

    if (commandWindow.status === "completed") {
      return this.result({
        status: "sandbox_verified",
        parsed,
        patchResult,
        commandWindow,
        summary: "Sandbox patch proof chain verified the patch with command evidence."
      });
    }

    if (commandWindow.status === "stopped") {
      return this.result({
        status: "sandbox_failed",
        parsed,
        patchResult,
        commandWindow,
        firstRemainingFailure: commandWindow.firstRemainingFailure,
        summary: "Patch proof chain stopped on first remaining command failure."
      });
    }

    return this.result({
      status: commandWindow.status === "ready" || commandWindow.status === "command_recorded" ? "needs_human_apply_decision" : "blocked",
      parsed,
      patchResult,
      commandWindow,
      blockingReasons: commandWindow.blockingReasons.length
        ? commandWindow.blockingReasons
        : ["Command proof is incomplete; sandbox cannot be treated as verified."],
      summary: "Patch proof chain did not reach sandbox_verified."
    });
  }

  private result(input: {
    status: PatchProofChainStatus;
    parsed: ReturnType<typeof PatchProofChainInputSchema.parse>;
    patchResult?: SandboxPatchWindowResult;
    commandWindow?: SandboxCommandWindowResult;
    firstRemainingFailure?: string;
    blockingReasons?: string[];
    summary: string;
  }): PatchProofChainResult {
    const commandResults = input.commandWindow?.commandResults ?? [];
    const evidenceIds = input.commandWindow?.evidenceIds ?? [];
    const changedFiles = input.patchResult?.changedFiles ?? [];
    const firstRemainingFailure = input.firstRemainingFailure ?? input.commandWindow?.firstRemainingFailure;
    const missingCommandEvidence = (input.status === "sandbox_verified" || input.status === "needs_human_apply_decision") && evidenceIds.length === 0;
    const applyPacketStatus = input.status === "sandbox_verified"
      ? "sandbox_verified"
      : input.status === "sandbox_failed"
        ? "sandbox_failed"
        : "blocked";
    const applyPacket = new HumanApplyPacketBuilder().build({
      status: applyPacketStatus,
      packetId: input.parsed.packet.packetId,
      workspace: input.parsed.workspace,
      sandboxPath: input.parsed.sandboxPath,
      linkedRepoPath: input.parsed.linkedRepoPath,
      changedFiles,
      patchDiffPath: input.patchResult?.diffPath,
      patchEvidenceId: input.patchResult?.patchEvidenceId,
      commandResults,
      commandEvidenceIds: evidenceIds,
      firstRemainingFailure,
      blockingReasons: input.blockingReasons ?? [],
      missingCommandEvidence
    });
    return PatchProofChainResultSchema.parse({
      status: input.status,
      packetId: input.parsed.packet.packetId,
      patchDiffPath: input.patchResult?.diffPath,
      patchEvidenceId: input.patchResult?.patchEvidenceId,
      commandsRun: input.commandWindow?.commandsRun ?? [],
      commandResults,
      evidenceIds,
      firstRemainingFailure,
      changedFiles,
      applyRecommendation: applyPacket.recommendation,
      applyPacket,
      blockingReasons: input.blockingReasons ?? [],
      summary: input.summary
    });
  }
}
