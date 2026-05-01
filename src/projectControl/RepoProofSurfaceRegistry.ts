import {
  RepoProofSurfaceRegistrySchema,
  type RepoProofSurface,
  type RepoProofSurfaceId
} from "./RepoProofSurfaceSchemas.js";

const SURFACES: RepoProofSurface[] = RepoProofSurfaceRegistrySchema.parse([
  {
    repoId: "admission_app",
    aliases: ["ADMISSION-APP", "app-admissions", "admission-app", "admissions checker", "admissions pipeline"],
    repoPath: "/Users/deanguedo/Documents/GitHub/ADMISSION-APP",
    commands: {
      build: "npm run build:pages",
      syncPreflight: "pwsh -NoProfile -ExecutionPolicy Bypass -File ./tools/validate-sync-surface.ps1",
      appsScriptValidation: "pwsh -NoProfile -ExecutionPolicy Bypass -File ./tools/validate-apps-script-structure.ps1",
      canonicalValidation: "pwsh -NoProfile -ExecutionPolicy Bypass -File ./tools/validate-canonical.ps1"
    },
    files: {
      requiredSheetsConfig: "config/sheets_sync.json",
      exampleSheetsConfig: "config/sheets_sync.json.example",
      canonicalCsv: "data/ALBERTA_ADMISSIONS_MASTER_CANONICAL.csv",
      pipelineDocs: "docs/PIPELINE.md"
    },
    blockedLiveActions: ["SYNC_ALL.cmd", "PUBLISH_DATA_TO_SHEETS.bat", "SYNC_PROGRAMS.cmd"],
    proofArtifacts: ["preflight command output", "canonical validation output", "build:pages output"],
    stopConditions: [
      "stop before publish/sync/deploy/push",
      "stop if config/sheets_sync.json is missing",
      "stop if preflight command cannot run"
    ],
    notes: [
      "config/sheets_sync.json.example is an example only, not a live target config",
      "file existence is not publish readiness"
    ]
  },
  {
    repoId: "canvas_helper",
    aliases: ["canvas-helper", "Sports Wellness", "sportswellness"],
    repoPath: "/Users/deanguedo/Documents/GitHub/canvas-helper",
    commands: {
      build: "npm run build:studio",
      typecheck: "npm run typecheck",
      courseShellTest: "npm run test:course-shell",
      e2e: "npm run test:e2e",
      scopedE2e: "npm run test:e2e:project"
    },
    files: {
      sportsWellnessHtml: "projects/sportswellness/workspace/index.html",
      sportsWellnessCss: "projects/sportswellness/workspace/styles.css",
      sportsWellnessJs: "projects/sportswellness/workspace/main.js"
    },
    blockedLiveActions: [],
    proofArtifacts: ["rendered screenshot/checklist"],
    stopConditions: [
      "stop if screenshot/checklist is unavailable",
      "stop if CSS/source diff is the only visual proof"
    ],
    notes: [
      "visual proof requires rendered screenshot/checklist",
      "CSS diff alone is not visual proof"
    ]
  },
  {
    repoId: "brightspacequizexporter",
    aliases: ["brightspacequizexporter", "Brightspace"],
    repoPath: "/Users/deanguedo/Documents/GitHub/brightspacequizexporter",
    commands: {
      dependencyProof: "npm ls @rollup/rollup-darwin-arm64 rollup vite",
      build: "npm run build",
      ingestGate: "npm run ingest:ci",
      forbiddenSeedGold: "npm run ingest:seed-gold"
    },
    files: {
      packageLock: "package-lock.json",
      packageJson: "package.json",
      tmpGitkeep: "tmp/.gitkeep"
    },
    blockedLiveActions: ["npm run ingest:seed-gold"],
    proofArtifacts: ["build output", "ingest:ci output"],
    stopConditions: [
      "stop if parser/source/fixture/gold scope appears in dependency repair",
      "stop on first failed proof command"
    ],
    notes: [
      "dependency/install changes are separate from parser/source/fixture/gold changes",
      "ingest:seed-gold is forbidden as proof"
    ]
  }
]);

export function listRepoProofSurfaces(): RepoProofSurface[] {
  return [...SURFACES];
}

export function getRepoProofSurface(repoId: RepoProofSurfaceId): RepoProofSurface {
  return SURFACES.find((surface) => surface.repoId === repoId) as RepoProofSurface;
}

export function findRepoProofSurface(text: string): RepoProofSurface | undefined {
  const normalized = text.toLowerCase();
  return SURFACES.find((surface) =>
    surface.aliases.some((alias) => normalized.includes(alias.toLowerCase())) ||
    normalized.includes(surface.repoPath.toLowerCase())
  );
}

export function formatBlockedActions(surface: RepoProofSurface): string {
  return surface.blockedLiveActions.length ? surface.blockedLiveActions.join(", ") : "none";
}
