import { collectCodexTurn, writeSidecarHeartbeat, type CollectCodexTurnResult } from "./CodexTurnCapture.js";
import { validateRepoPath } from "./SidecarRepo.js";

export type SidecarRefreshResult = {
  schemaVersion: "stax-sidecar-refresh-v1";
  repoPath: string;
  refreshedAt: string;
  heartbeatPath: string;
  turn: CollectCodexTurnResult;
};

export type RefreshSidecarOptions = {
  repoPath: string;
  sessionsRoot?: string;
  sourceFile?: string;
  now?: Date;
};

export async function refreshSidecar(options: RefreshSidecarOptions): Promise<SidecarRefreshResult> {
  const repoPath = await validateRepoPath(options.repoPath);
  const now = options.now ?? new Date();
  const heartbeatPath = await writeSidecarHeartbeat({
    repoPath,
    now
  });
  const turn = await collectCodexTurn({
    repoPath,
    sessionsRoot: options.sessionsRoot,
    sourceFile: options.sourceFile,
    now
  });

  return {
    schemaVersion: "stax-sidecar-refresh-v1",
    repoPath,
    refreshedAt: now.toISOString(),
    heartbeatPath,
    turn
  };
}
