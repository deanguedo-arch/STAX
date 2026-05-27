import type { RepoDiscoveryResult, RepoPackageScript } from "./RepoDiscoverySchemas.js";

export type CommandSurfaceKind =
  | "build"
  | "test"
  | "typecheck"
  | "lint"
  | "e2e"
  | "smoke"
  | "validate"
  | "export"
  | "preflight"
  | "publish"
  | "sync"
  | "deploy"
  | "release"
  | "data"
  | "gold";

export type CommandSurface = {
  kind: CommandSurfaceKind;
  command: string;
  scriptName: string;
  source: string;
};

export function detectCommandSurfaces(discovery: RepoDiscoveryResult): CommandSurface[] {
  return dedupeSurfaces([
    ...discovery.packageScripts.flatMap((script) => surfacesForScript(script)),
    ...discovery.files.flatMap((file) => surfacesForDiscoveredFile(file))
  ]);
}

function surfacesForScript(script: RepoPackageScript): CommandSurface[] {
  const text = `${script.name} ${script.command}`.toLowerCase();
  const command = `npm run ${script.name}`;
  const surfaces: CommandSurface[] = [];
  const add = (kind: CommandSurfaceKind) => surfaces.push({ kind, command, scriptName: script.name, source: "package.json scripts" });
  const verificationLike = /^(?:test|validate|verify|check|smoke|lint|typecheck)(?::|$)/i.test(script.name);
  const liveLike = !verificationLike && /publish|\bsync\b|deploy|release|ship/.test(text);
  if (isBuildLike(text)) add("build");
  if (/\btest\b|vitest|jest|node --test/.test(text)) add("test");
  if (/typecheck|tsc --noemit|tsc --no-emit/.test(text)) add("typecheck");
  if (/\blint\b|eslint/.test(text)) add("lint");
  if (/e2e|playwright|cypress/.test(text)) add("e2e");
  if (/smoke/.test(text)) add("smoke");
  if (/validate|verify|check|audit/.test(text)) add("validate");
  if (/\bexport\b|google[-:]?hosted|course[-:]?shell/.test(text)) add("export");
  if (/preflight|dry[-:]?run|target|canonical/.test(text)) add("preflight");
  if (!verificationLike && /publish/.test(text)) add("publish");
  if (!verificationLike && /\bsync\b|sheets|clasp|apps-script|google/.test(text)) add("sync");
  if (!verificationLike && /deploy|hosting|firebase/.test(text)) add("deploy");
  if (!verificationLike && /release|ship/.test(text)) add("release");
  if (!liveLike && /ingest|data|pipeline|schema|fixture|csv|json/.test(text)) add("data");
  if (/seed-gold|update-gold|\bgold\b|snapshot|expected/.test(text)) add("gold");
  return dedupeSurfaces(surfaces);
}

function surfacesForDiscoveredFile(file: RepoDiscoveryResult["files"][number]): CommandSurface[] {
  if (!["script", "tool", "workflow"].includes(file.kind)) return [];
  if (!isDirectCommandFile(file)) return [];
  const text = file.path.toLowerCase();
  const command = file.path;
  const scriptName = file.path;
  const source = `${file.kind} file`;
  const surfaces: CommandSurface[] = [];
  const add = (kind: CommandSurfaceKind) => surfaces.push({ kind, command, scriptName, source });
  const verificationLike = /(?:^|\/)(?:test|check|validate|verify|smoke|lint|typecheck)[-_.]/i.test(file.path);

  if (isBuildLike(text)) add("build");
  if (/\btest\b|spec|vitest|jest/.test(text)) add("test");
  if (/typecheck|tsc/.test(text)) add("typecheck");
  if (/lint|eslint/.test(text)) add("lint");
  if (/e2e|playwright|cypress/.test(text)) add("e2e");
  if (/smoke/.test(text)) add("smoke");
  if (/validate|verify|check|audit/.test(text)) add("validate");
  if (/export|google[-_]?hosted|course[-_]?shell/.test(text)) add("export");
  const preflightLike = /validate|preflight|dry[-:]?run|target|canonical|structure|surface|check/.test(text);
  const liveLike = !verificationLike && !preflightLike && /publish|sync|deploy|release|ship/.test(text);
  if (preflightLike) add("preflight");
  if (liveLike && /publish/.test(text)) add("publish");
  if (liveLike && /sync|sheets|clasp|apps[-_]?script|google/.test(text)) add("sync");
  if (liveLike && /deploy|hosting|firebase/.test(text)) add("deploy");
  if (liveLike && /release|ship/.test(text)) add("release");
  if (!liveLike && /ingest|data|pipeline|schema|fixture|csv|json|dataset/.test(text)) add("data");
  if (/seed[-_]?gold|update[-_]?gold|\bgold\b|snapshot|expected/.test(text)) add("gold");
  return dedupeSurfaces(surfaces);
}

function isBuildLike(text: string): boolean {
  return /\bbuild\b|build[-_:]|[-_:/]build\b|compile/.test(text);
}

function isDirectCommandFile(file: RepoDiscoveryResult["files"][number]): boolean {
  const filePath = file.path.toLowerCase();
  if (file.kind === "workflow") return false;
  if (file.kind === "tool") return /\.(?:cmd|bat|ps1|sh|mjs|cjs|js|ts|py)$/.test(filePath);
  if (file.kind !== "script") return false;
  if (/^[^/]+\.(?:cmd|bat|ps1|sh)$/.test(filePath)) return true;
  return /\.(?:cmd|bat|ps1|sh)$/.test(filePath);
}

function dedupeSurfaces(surfaces: CommandSurface[]): CommandSurface[] {
  const seen = new Set<string>();
  return surfaces.filter((surface) => {
    const key = `${surface.kind}:${surface.command}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
