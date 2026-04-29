import { PatchProofChain } from "../verification/PatchProofChain.js";
import type { PatchProofChainResult } from "../verification/PatchProofChainSchemas.js";
import type { SandboxCommandRunner } from "../verification/SandboxCommandWindow.js";
import { LoopStateStore } from "./LoopStateStore.js";
import { LoopStopGate } from "./LoopStopGate.js";
import {
  SandboxLoopRunnerInputSchema,
  SandboxLoopRunnerResultSchema,
  type SandboxLoopRunnerInput,
  type SandboxLoopRunnerResult,
  type SandboxLoopState
} from "./SandboxLoopSchemas.js";

type ChainRunner = (input: Parameters<PatchProofChain["run"]>[0]) => Promise<PatchProofChainResult>;

export class SandboxLoopRunner {
  constructor(
    private rootDir = process.cwd(),
    private commandRunner?: SandboxCommandRunner,
    private chainRunner?: ChainRunner
  ) {}

  async run(input: SandboxLoopRunnerInput): Promise<SandboxLoopRunnerResult> {
    const parsed = SandboxLoopRunnerInputSchema.parse(input);
    const store = new LoopStateStore();
    store.record({ state: "planning", loopIndex: 0, summary: "Loop planned inside sandbox-only boundaries.", stopReason: "none" });

    const preStop = new LoopStopGate().evaluate({
      plannedStepIds: parsed.plannedStepIds,
      patchFailures: parsed.patchFailureCount,
      loopCount: 0,
      budget: parsed.budget
    });
    if (preStop.shouldStop) {
      store.record({ state: "blocked", loopIndex: 0, summary: preStop.summary, stopReason: preStop.reason });
      return SandboxLoopRunnerResultSchema.parse({
        status: preStop.reason === "two_patch_failures" ? "failed" : "blocked",
        mode: parsed.mode,
        loopsRun: 0,
        stopReason: preStop.reason,
        states: store.list(),
        mutatedLinkedRepo: false,
        summary: preStop.summary
      });
    }

    if (parsed.mode === "dry_run") {
      store.record({
        state: "needs_human_decision",
        loopIndex: 0,
        summary: "Dry run stopped at the first authority boundary; no sandbox command or patch executed.",
        stopReason: "needs_human_decision"
      });
      return SandboxLoopRunnerResultSchema.parse({
        status: "needs_human_decision",
        mode: parsed.mode,
        loopsRun: 0,
        stopReason: "needs_human_decision",
        states: store.list(),
        mutatedLinkedRepo: false,
        summary: "Dry run produced a bounded sandbox packet without executing commands or mutating files."
      });
    }

    store.record({ state: "sandbox_ready", loopIndex: 1, summary: "Sandbox path is the only execution boundary for this loop.", stopReason: "none" });
    if (parsed.mode === "sandbox_patch") {
      store.record({ state: "patch_attempted", loopIndex: 1, summary: "Approved sandbox patch attempt delegated to PatchProofChain.", stopReason: "none" });
    }
    store.record({ state: "commands_running", loopIndex: 1, summary: "Allowlisted command proof delegated to PatchProofChain.", stopReason: "none" });

    const chainResult = await this.runChain({
      packet: parsed.packet,
      workspace: parsed.workspace,
      sandboxPath: parsed.sandboxPath,
      linkedRepoPath: parsed.linkedRepoPath,
      humanApprovedPatch: parsed.humanApprovedPatch,
      humanApprovedCommandWindow: parsed.humanApprovedCommandWindow,
      execute: parsed.execute,
      operations: parsed.mode === "sandbox_patch" ? parsed.operations : [],
      commands: parsed.commands
    });

    const stop = new LoopStopGate().evaluate({
      goalVerified: chainResult.status === "sandbox_verified",
      forbiddenDiff: chainResult.blockingReasons.some((reason) => /forbidden|outside the allowed|matches a forbidden/i.test(reason)),
      failedCommand: chainResult.status === "sandbox_failed",
      needsHumanDecision: chainResult.status === "sandbox_verified",
      loopCount: 1,
      budget: parsed.budget
    });
    const status = stateFor(chainResult, stop.shouldStop ? stop.reason : "none");
    store.record({
      state: status,
      loopIndex: 1,
      summary: chainResult.summary,
      stopReason: stop.reason
    });

    return SandboxLoopRunnerResultSchema.parse({
      status,
      mode: parsed.mode,
      loopsRun: 1,
      stopReason: stop.reason,
      states: store.list(),
      chainResult,
      applyPacket: chainResult.applyPacket,
      firstRemainingFailure: chainResult.firstRemainingFailure,
      mutatedLinkedRepo: false,
      summary: chainResult.status === "sandbox_verified"
        ? "Sandbox loop verified the packet and stopped at the human apply decision."
        : chainResult.summary
    });
  }

  private async runChain(input: Parameters<PatchProofChain["run"]>[0]): Promise<PatchProofChainResult> {
    if (this.chainRunner) return this.chainRunner(input);
    return new PatchProofChain(this.rootDir, this.commandRunner).run(input);
  }
}

function stateFor(chainResult: PatchProofChainResult, stopReason: string): SandboxLoopState {
  if (chainResult.status === "sandbox_verified") return stopReason === "goal_verified" ? "done" : "needs_human_decision";
  if (chainResult.status === "sandbox_failed") return "failed";
  if (chainResult.status === "blocked") return "blocked";
  return "needs_human_decision";
}
