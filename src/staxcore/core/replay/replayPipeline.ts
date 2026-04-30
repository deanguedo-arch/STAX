import type { Provenance } from "../../types/index.js";
import { AppendOnlyLedger, stableHash } from "../../shared/index.js";
import { processObservation } from "../api/processObservation.js";
import { stableOutputSignature } from "./replayObservation.js";

export interface ReplayPipelineInput {
  content: string;
  provenance: Provenance;
}

export interface ReplayPipelineResult {
  deterministic: boolean;
  chainValid: boolean;
  runOutputHashes: string[];
  controlOutputHashes: string[];
  ledgerHashes: string[];
  chainIssues: string[];
}

interface ReplayLedgerEvent {
  index: number;
  inputHash: string;
  outputHash: string;
  warningCount: number;
  status: string;
}

function runSequence(inputs: ReplayPipelineInput[]): string[] {
  return inputs.map((item) =>
    stableOutputSignature(processObservation(item.content, item.provenance))
  );
}

export function replayPipeline(
  inputs: ReplayPipelineInput[],
  doctrineVersion = "core-v1"
): ReplayPipelineResult {
  const ledger = new AppendOnlyLedger<ReplayLedgerEvent>();
  const runOutputHashes: string[] = [];

  for (const [index, item] of inputs.entries()) {
    const output = processObservation(item.content, item.provenance);
    const outputHash = stableOutputSignature(output);
    const inputHash = stableHash({ content: item.content, provenance: item.provenance });
    runOutputHashes.push(outputHash);
    ledger.append(
      `replay_event_${index + 1}`,
      {
        index,
        inputHash,
        outputHash,
        warningCount: output.warnings.length,
        status: output.status
      },
      { doctrineVersion }
    );
  }

  const controlOutputHashes = runSequence(inputs);
  const deterministic = runOutputHashes.every(
    (hash, index) => hash === controlOutputHashes[index]
  );
  const chainCheck = ledger.verifyChain();

  return {
    deterministic,
    chainValid: chainCheck.valid,
    runOutputHashes,
    controlOutputHashes,
    ledgerHashes: ledger.replay().map((entry) => entry.ledgerHash),
    chainIssues: chainCheck.issues
  };
}
