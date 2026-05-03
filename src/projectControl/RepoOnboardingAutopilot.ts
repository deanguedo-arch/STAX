import fs from "node:fs/promises";
import {
  findRepoCandidate,
  findRepoArchetype,
  guidanceForRepoTransfer,
  type RepoArchetypeGuidance
} from "../repoTransfer/RepoTransferRegistry.js";
import { findRepoProofSurface } from "./RepoProofSurfaceRegistry.js";

export type RepoOnboardingCard = {
  repoLabel: string;
  repoPath?: string;
  repoFullName?: string;
  archetype?: string;
  packageManager: string;
  proofGates: string[];
  dangerousActions: string[];
  likelyEnvironmentBlockers: string[];
  commonFailurePatterns: string[];
  firstSafeAuditCommand: string;
  visualProofRequired: boolean;
  source: "local_repo_inspection" | "repo_proof_surface_registry" | "repo_transfer_registry";
  notes: string[];
};

export async function buildRepoOnboardingCard(args: {
  repoPath?: string;
  repoFullName?: string;
  archetypeName?: string;
  observedTopLevelFiles?: string[];
}): Promise<RepoOnboardingCard> {
  const topLevelFiles = args.observedTopLevelFiles ?? (args.repoPath ? await inspectTopLevelFiles(args.repoPath) : []);
  return buildRepoOnboardingCardFromInputs({
    ...args,
    observedTopLevelFiles: topLevelFiles
  });
}

export function buildRepoOnboardingCardFromInputs(args: {
  repoPath?: string;
  repoFullName?: string;
  archetypeName?: string;
  observedTopLevelFiles?: string[];
}): RepoOnboardingCard {
  const repoLabel = args.repoFullName ?? args.repoPath ?? "unknown repo";
  const topLevelFiles = args.observedTopLevelFiles ?? [];
  const packageManager = detectPackageManager(topLevelFiles);
  const localSurface = args.repoPath ? findRepoProofSurface(args.repoPath) : undefined;
  const candidate = args.repoFullName ? findRepoCandidate(args.repoFullName) : undefined;
  const inferredArchetype = inferArchetypeFromFiles(topLevelFiles);
  const guidance = guidanceForRepoTransfer({
    repoFullName: args.repoFullName,
    archetypeName: args.archetypeName ?? inferredArchetype
  });
  const explicitArchetype = findRepoArchetype(args.archetypeName ?? candidate?.archetype ?? inferredArchetype);

  const proofGates = deriveProofGates({ localSurface, guidance, packageManager, topLevelFiles });
  const dangerousActions = dedupe([
    ...(localSurface?.blockedLiveActions ?? []),
    ...(guidance?.dangerousActions ?? []),
    ...defaultDangerousActions(topLevelFiles)
  ]);
  const likelyEnvironmentBlockers = dedupe([
    ...(guidance?.likelyEnvironmentBlockers ?? []),
    ...defaultEnvironmentBlockers(topLevelFiles)
  ]);
  const commonFailurePatterns = dedupe([
    ...(guidance?.highRiskPatterns ?? []),
    ...(guidance?.failurePatternsToTest ?? []),
    ...defaultFailurePatterns(topLevelFiles)
  ]);
  const firstSafeAuditCommand = deriveFirstSafeAuditCommand({ localSurface, packageManager, topLevelFiles });
  const visualProofRequired = Boolean(
    localSurface?.proofArtifacts.some((artifact) => /screenshot|visual/i.test(artifact)) ||
      guidance?.archetype === "ui_visual_system" ||
      guidance?.archetype === "typescript_e2e_browser" ||
      /playwright\.config|storybook|\.storybook|styles?\.(css|scss|sass|less)$/i.test(topLevelFiles.join("\n"))
  );

  const notes = dedupe([
    ...(localSurface?.notes ?? []),
    ...(guidance?.whySelected ? [guidance.whySelected] : []),
    ...defaultNotes({ packageManager, guidance, topLevelFiles, visualProofRequired })
  ]);

  return {
    repoLabel,
    repoPath: args.repoPath,
    repoFullName: args.repoFullName,
    archetype: explicitArchetype?.archetype ?? guidance?.archetype ?? inferredArchetype,
    packageManager,
    proofGates,
    dangerousActions,
    likelyEnvironmentBlockers,
    commonFailurePatterns,
    firstSafeAuditCommand,
    visualProofRequired,
    source: localSurface ? "repo_proof_surface_registry" : guidance ? "repo_transfer_registry" : "local_repo_inspection",
    notes
  };
}

async function inspectTopLevelFiles(repoPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(repoPath, { withFileTypes: true });
    return entries.map((entry) => entry.name).sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function detectPackageManager(files: string[]): string {
  if (files.includes("pnpm-lock.yaml")) return "pnpm";
  if (files.includes("yarn.lock")) return "yarn";
  if (files.includes("package-lock.json") || files.includes("package.json")) return "npm";
  if (files.includes("Cargo.toml")) return "cargo";
  if (files.includes("go.mod") || files.includes("go.work")) return "go";
  if (files.includes("Gemfile")) return "bundler";
  if (files.includes("composer.json")) return "composer";
  if (files.includes("uv.lock")) return "uv";
  if (files.includes("poetry.lock")) return "poetry";
  if (files.includes("pyproject.toml")) return "python_project";
  if (files.includes("requirements.txt") || files.includes("pytest.ini")) return "pip";
  return "unknown";
}

function inferArchetypeFromFiles(files: string[]): string | undefined {
  if (files.includes("playwright.config.ts") || files.includes("playwright.config.js")) return "typescript_e2e_browser";
  if (files.includes("vite.config.ts") || files.includes("vite.config.js")) return "js_build_tooling";
  if (files.includes("pytest.ini")) return "python_test_framework";
  if (files.includes("manage.py")) return "python_web_framework";
  if (files.includes("dbt_project.yml")) return "data_pipeline";
  if (files.includes(".storybook") || files.some((file) => file.startsWith(".storybook"))) return "ui_visual_system";
  if (files.includes("go.work")) return "go_monorepo_integration";
  if (files.includes("go.mod")) return "go_infra_tooling";
  if (files.includes("Gemfile")) return "ruby_framework";
  if (files.includes("composer.json")) return "php_framework";
  if (files.includes("Cargo.toml")) return "rust_async_workspace";
  return undefined;
}

function deriveProofGates(args: {
  localSurface?: ReturnType<typeof findRepoProofSurface>;
  guidance?: RepoArchetypeGuidance;
  packageManager: string;
  topLevelFiles: string[];
}): string[] {
  const localCommands = args.localSurface ? Object.values(args.localSurface.commands) : [];
  const registryGates = args.guidance?.proofGates ?? [];
  const inferred = defaultProofGates(args.packageManager, args.topLevelFiles);
  return dedupe([...localCommands, ...registryGates, ...inferred]).slice(0, 8);
}

function deriveFirstSafeAuditCommand(args: {
  localSurface?: ReturnType<typeof findRepoProofSurface>;
  packageManager: string;
  topLevelFiles: string[];
}): string {
  if (args.localSurface?.commands.canonicalValidation) return args.localSurface.commands.canonicalValidation;
  if (args.localSurface?.commands.dependencyProof) return args.localSurface.commands.dependencyProof;
  if (args.localSurface?.commands.build) return args.localSurface.commands.build;
  if (args.packageManager === "cargo") return "cargo test -- --help";
  if (args.packageManager === "go") return "go test ./... -run TestDoesNotExist";
  if (args.packageManager === "bundler") return "bundle exec rspec --help";
  if (args.packageManager === "composer") return "composer test -- --help";
  if (args.packageManager === "pnpm") return "pnpm test -- --help";
  if (args.packageManager === "yarn") return "yarn test --help";
  if (args.packageManager === "npm") return "npm test -- --help";
  if (args.packageManager === "uv") return "uv run pytest --help";
  if (args.packageManager === "poetry" || args.packageManager === "python_project") return "python -m pytest --help";
  if (args.packageManager === "pip") return "pytest --help";
  return "pwd && git branch --show-current && git status --short";
}

function defaultProofGates(packageManager: string, files: string[]): string[] {
  const gates: string[] = [];
  if (packageManager === "npm" || packageManager === "pnpm" || packageManager === "yarn") {
    gates.push(`${packageManager} test`, `${packageManager} run build`);
  }
  if (packageManager === "cargo") gates.push("cargo test", "cargo check");
  if (packageManager === "go") gates.push("go test ./...");
  if (packageManager === "bundler") gates.push("bundle exec rspec");
  if (packageManager === "composer") gates.push("composer test");
  if (packageManager === "uv") gates.push("uv run pytest");
  if (packageManager === "poetry" || packageManager === "python_project" || packageManager === "pip") gates.push("pytest");
  if (files.includes("playwright.config.ts") || files.includes("playwright.config.js")) gates.push("playwright test");
  if (files.includes("dbt_project.yml")) gates.push("dbt test", "dbt build --fail-fast");
  if (files.includes(".storybook") || files.some((file) => file.startsWith(".storybook"))) gates.push("storybook build", "visual screenshot/checklist");
  return gates;
}

function defaultDangerousActions(files: string[]): string[] {
  const joined = files.join("\n").toLowerCase();
  const actions: string[] = [];
  if (joined.includes("dbt_project.yml")) actions.push("dbt run", "dbt build", "publish", "sync");
  if (joined.includes("terraform")) actions.push("terraform apply");
  if (joined.includes("package.json")) actions.push("publish", "release", "deploy");
  return actions;
}

function defaultEnvironmentBlockers(files: string[]): string[] {
  const blockers: string[] = [];
  if (files.includes("package.json")) blockers.push("node_modules or package-manager install state");
  if (files.includes("Cargo.toml")) blockers.push("Rust toolchain and workspace features");
  if (files.includes("go.mod")) blockers.push("Go toolchain and module cache");
  if (files.includes("Gemfile")) blockers.push("Ruby version and bundle install state");
  if (files.includes("composer.json")) blockers.push("PHP/composer install state");
  if (files.includes("dbt_project.yml")) blockers.push("profiles.yml or warehouse credentials");
  if (files.includes("playwright.config.ts") || files.includes("playwright.config.js")) blockers.push("browser binaries and headed/headless environment");
  return blockers;
}

function defaultFailurePatterns(files: string[]): string[] {
  const patterns: string[] = [];
  if (files.includes("package.json")) patterns.push("script_exists_not_passed", "wrong_workspace_command");
  if (files.includes("playwright.config.ts") || files.includes("playwright.config.js")) patterns.push("visual_claim_without_rendered_proof");
  if (files.includes("dbt_project.yml")) patterns.push("publish_without_validation", "fixture_or_golden_laundering");
  if (files.includes("Cargo.toml") || files.includes("go.mod")) patterns.push("dependency_change_without_runtime_proof");
  return patterns;
}

function defaultNotes(args: {
  packageManager: string;
  guidance?: RepoArchetypeGuidance;
  topLevelFiles: string[];
  visualProofRequired: boolean;
}): string[] {
  const notes: string[] = [];
  if (args.packageManager === "unknown") {
    notes.push("Package manager is still unknown; inspect repo files before treating any command candidate as authoritative.");
  }
  if (args.guidance?.fullLocalTestsLikelyTooExpensive) {
    notes.push("Full local test runs are likely too expensive here; stay bounded.");
  }
  if (args.visualProofRequired) {
    notes.push("Visual/UI claims need rendered proof, not only source or CSS diffs.");
  }
  if (args.topLevelFiles.includes("dbt_project.yml")) {
    notes.push("Data pipeline claims need dry-run, validation, or row-count evidence before publish/sync boundaries.");
  }
  return notes;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function formatRepoOnboardingCard(card: RepoOnboardingCard): string {
  return [
    `Repo: ${card.repoLabel}`,
    `- archetype: ${card.archetype ?? "unknown"}`,
    `- package manager: ${card.packageManager}`,
    `- source: ${card.source}`,
    `- visual proof required: ${card.visualProofRequired ? "yes" : "no"}`,
    "",
    "Proof Gates",
    ...card.proofGates.map((item) => `- ${item}`),
    "",
    "Dangerous Actions",
    ...(card.dangerousActions.length ? card.dangerousActions.map((item) => `- ${item}`) : ["- none"]),
    "",
    "Environment Blockers",
    ...(card.likelyEnvironmentBlockers.length ? card.likelyEnvironmentBlockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "Failure Patterns",
    ...(card.commonFailurePatterns.length ? card.commonFailurePatterns.map((item) => `- ${item}`) : ["- none"]),
    "",
    "First Safe Audit Command",
    `- ${card.firstSafeAuditCommand}`,
    "",
    "Notes",
    ...(card.notes.length ? card.notes.map((item) => `- ${item}`) : ["- none"])
  ].join("\n");
}
