import type { CommandSurface } from "./CommandSurfaceDetector.js";
import type { RepoDiscoveryResult } from "./RepoDiscoverySchemas.js";

export type RiskSurface = {
  kind: "publish_sync_deploy" | "gold_fixture_mutation" | "visual_layout" | "data_pipeline";
  description: string;
  commands: string[];
  confidence: "low" | "medium" | "high";
};

export function detectRiskSurfaces(discovery: RepoDiscoveryResult, commandSurfaces: CommandSurface[]): RiskSurface[] {
  const risks: RiskSurface[] = [];
  const riskyLiveCommands = commandSurfaces.filter((surface) => ["publish", "sync", "deploy", "release"].includes(surface.kind));
  if (riskyLiveCommands.length > 0) {
    risks.push({
      kind: "publish_sync_deploy",
      description: "Publish/sync/deploy-like commands were detected.",
      commands: riskyLiveCommands.map((surface) => surface.command),
      confidence: "high"
    });
  }
  const goldCommands = commandSurfaces.filter((surface) => surface.kind === "gold");
  const goldFiles = discovery.files.filter((file) => /gold|fixture|snapshot|expected|benchmark/i.test(file.path));
  if (goldCommands.length > 0 || goldFiles.length > 0) {
    risks.push({
      kind: "gold_fixture_mutation",
      description: "Gold, fixture, snapshot, expected, or benchmark surfaces were detected.",
      commands: goldCommands.map((surface) => surface.command),
      confidence: goldCommands.length > 0 ? "high" : "medium"
    });
  }
  const visualSignals = discovery.files.some((file) => /\.html$|\.css$|workspace|playwright|cypress|storybook/i.test(file.path));
  if (visualSignals) {
    risks.push({
      kind: "visual_layout",
      description: "Visual/layout surfaces were detected.",
      commands: commandSurfaces.filter((surface) => ["e2e", "smoke"].includes(surface.kind)).map((surface) => surface.command),
      confidence: "high"
    });
  }
  const dataSignals = discovery.files.some((file) => /data|pipeline|schema|fixture|csv|json|canonical/i.test(file.path));
  if (dataSignals || commandSurfaces.some((surface) => surface.kind === "data")) {
    risks.push({
      kind: "data_pipeline",
      description: "Data pipeline or fixture surfaces were detected.",
      commands: commandSurfaces.filter((surface) => surface.kind === "data").map((surface) => surface.command),
      confidence: "medium"
    });
  }
  return risks;
}
