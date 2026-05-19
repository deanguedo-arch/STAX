import fs from "node:fs/promises";
import path from "node:path";
import {
  StaxImpactEvidenceBundleSchema,
  type StaxImpactEvidenceBundle
} from "../src/learning/PatternPromotionImpactSchemas.js";
import {
  collectGitSnapshot,
  ensureDirectory,
  nowIso,
  pathExists,
  readTextIfExists,
  runGit,
  sha256,
  sidecarDir,
  validateRepoPath
} from "../src/sidecar/SidecarRepo.js";

function argValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  const eq = argv.find((arg) => arg.startsWith(`${name}=`));
  return eq ? eq.slice(`${name}=`.length) : index >= 0 ? argv[index + 1] : undefined;
}

function argFlag(argv: string[], name: string): boolean | undefined {
  if (argv.includes(name)) return true;
  if (argv.includes(`--no-${name.slice(2)}`)) return false;
  return undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const repoArg = argValue(argv, "--repo");
  const outArg = argValue(argv, "--out");
  if (!repoArg || !outArg) {
    throw new Error("Usage: npm run stax:export-impact-evidence -- --repo <path> --out <file>");
  }

  const repoPath = await validateRepoPath(repoArg);
  const outPath = path.resolve(process.cwd(), outArg);
  const bundle = await buildImpactEvidenceBundle(repoPath, {
    criticalMiss: argFlag(argv, "--critical-miss"),
    cleanupPromptNeeded: argFlag(argv, "--cleanup-prompt-needed"),
    fullHandoffContractPresent: argFlag(argv, "--full-handoff-contract-present"),
    proofArtifactRequested: argFlag(argv, "--proof-artifact-requested")
  });

  await ensureDirectory(path.dirname(outPath));
  await fs.writeFile(outPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${JSON.stringify(
      {
        out: outPath,
        repo: bundle.repo.name,
        branch: bundle.repo.branch,
        head: bundle.repo.head,
        commandEvidence: bundle.commandEvidence.length,
        artifacts: bundle.artifacts.length,
        criticalMiss: bundle.criticalMiss,
        cleanupPromptNeeded: bundle.cleanupPromptNeeded,
        fullHandoffContractPresent: bundle.fullHandoffContractPresent,
        proofArtifactRequested: bundle.proofArtifactRequested
      },
      null,
      2
    )}\n`
  );
}

async function buildImpactEvidenceBundle(
  repoPath: string,
  overrides: {
    criticalMiss?: boolean;
    cleanupPromptNeeded?: boolean;
    fullHandoffContractPresent?: boolean;
    proofArtifactRequested?: boolean;
  }
): Promise<StaxImpactEvidenceBundle> {
  const snapshot = await collectGitSnapshot(repoPath);
  const staxPath = sidecarDir(repoPath);
  const [task, statusRaw, codexReport, nextPrompt, configRaw, proofSurfacesRaw] = await Promise.all([
    readTextIfExists(path.join(staxPath, "task.md")),
    readTextIfExists(path.join(staxPath, "status.json")),
    readTextIfExists(path.join(staxPath, "codex-report.md")),
    readTextIfExists(path.join(staxPath, "next-codex-prompt.md")),
    readTextIfExists(path.join(staxPath, "config.json")),
    readTextIfExists(path.join(staxPath, "proof-surfaces.json"))
  ]);
  const status = parseJsonObject(statusRaw);
  const config = parseJsonObject(configRaw);
  const proofSurfaces = parseJsonObject(proofSurfacesRaw);
  const artifacts = await collectArtifacts(staxPath);
  const commandEvidence = await collectCommandEvidence(staxPath);
  const staxCommit = await runGit(process.cwd(), ["rev-parse", "HEAD"]);
  const inferredCriticalMiss = hasCriticalMiss(statusRaw, status);
  const inferredCleanupPromptNeeded = inferCleanupPromptNeeded(statusRaw, nextPrompt);
  const inferredHandoffContract = hasFullHandoffContract(codexReport);
  const inferredProofArtifactRequested = inferProofArtifactRequested(statusRaw, nextPrompt, codexReport);

  return StaxImpactEvidenceBundleSchema.parse({
    schemaVersion: "stax-impact-evidence-bundle-v1",
    generatedAt: nowIso(),
    repo: {
      path: snapshot.repoPath,
      name: snapshot.repoName,
      branch: snapshot.branch,
      head: snapshot.commitSha,
      dirtyStatus: snapshot.gitStatusShort
    },
    stax: {
      commit: staxCommit || undefined,
      sidecarProtocolVersion: stringField(config, "sidecarProtocolVersion"),
      proofSurfaceVersion: stringField(proofSurfaces, "schemaVersion")
    },
    task,
    staxOutput: statusRaw,
    codexReport,
    commandEvidence,
    artifacts,
    criticalMiss: overrides.criticalMiss ?? inferredCriticalMiss,
    cleanupPromptNeeded: overrides.cleanupPromptNeeded ?? inferredCleanupPromptNeeded,
    fullHandoffContractPresent: overrides.fullHandoffContractPresent ?? inferredHandoffContract,
    proofArtifactRequested: overrides.proofArtifactRequested ?? inferredProofArtifactRequested
  });
}

async function collectCommandEvidence(staxPath: string): Promise<StaxImpactEvidenceBundle["commandEvidence"]> {
  const evidenceDir = path.join(staxPath, "command-evidence");
  const names = (await fs.readdir(evidenceDir).catch(() => [])).filter((name) => name.endsWith(".json")).sort();
  const evidence: StaxImpactEvidenceBundle["commandEvidence"] = [];
  for (const name of names) {
    const pointerPath = path.join(evidenceDir, name);
    const pointer = parseJsonObject(await readTextIfExists(pointerPath));
    const externalEvidencePath = stringField(pointer, "evidencePath");
    const external = externalEvidencePath ? parseJsonObject(await readTextIfExists(externalEvidencePath)) : {};
    evidence.push({
      evidenceId: stringField(pointer, "evidenceId") ?? stringField(external, "evidenceId"),
      command: stringField(external, "command"),
      exitCode: numberField(external, "exitCode"),
      source: stringField(external, "source"),
      provenanceStatus: stringField(external, "provenanceStatus"),
      worktreeAfterHash: stringField(pointer, "worktreeAfterHash") ?? nestedStringField(external, ["worktreeAfter", "fingerprintHash"]),
      canonicalEvidenceHash: stringField(pointer, "canonicalEvidenceHash") ?? stringField(external, "canonicalEvidenceHash"),
      recordedAt: stringField(pointer, "recordedAt") ?? stringField(external, "finishedAt")
    });
  }
  return evidence;
}

async function collectArtifacts(staxPath: string): Promise<StaxImpactEvidenceBundle["artifacts"]> {
  const relativePaths = [
    "status.json",
    "proof_strength.json",
    "next-codex-prompt.md",
    "reports/latest-proof-report.md",
    "reports/latest-confidence-report.md",
    "proof-surfaces.json",
    "proof-surfaces.candidate.json",
    "proof-surfaces.review.md",
    "visual-proofs/manifest.json"
  ];
  const artifacts: StaxImpactEvidenceBundle["artifacts"] = [];
  for (const relativePath of relativePaths) {
    const absolutePath = path.join(staxPath, relativePath);
    if (!(await pathExists(absolutePath))) continue;
    const raw = await fs.readFile(absolutePath);
    artifacts.push({
      kind: artifactKind(relativePath),
      path: path.join(".stax", relativePath),
      hash: sha256(raw.toString("utf8")),
      summary: `${relativePath} present`
    });
  }
  return artifacts;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function stringField(value: Record<string, unknown>, key: string): string | undefined {
  const raw = value[key];
  return typeof raw === "string" && raw.trim() ? raw : undefined;
}

function nestedStringField(value: Record<string, unknown>, pathParts: string[]): string | undefined {
  let current: unknown = value;
  for (const part of pathParts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" && current.trim() ? current : undefined;
}

function numberField(value: Record<string, unknown>, key: string): number | undefined {
  const raw = value[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

function hasCriticalMiss(statusRaw: string, status: Record<string, unknown>): boolean {
  const verdict = stringField(status, "verdict");
  const risk = Array.isArray(status.risk) ? status.risk.join("\n") : "";
  return verdict === "Reject" && /critical|false accept|wrong repo|tampered|stale evidence/i.test(`${statusRaw}\n${risk}`);
}

function inferCleanupPromptNeeded(statusRaw: string, nextPrompt: string): boolean {
  return /Status["\s:]+(?:Reject|Provisional|Human review)|cleanup pass|next action|proof gap|unverified/i.test(`${statusRaw}\n${nextPrompt}`);
}

function hasFullHandoffContract(codexReport: string): boolean {
  const required = [
    "STAX acknowledgement",
    "Objective",
    "Files changed",
    "Commands run",
    "What is verified",
    "What is unverified",
    "Risks",
    "One next action"
  ];
  return required.every((section) => codexReport.includes(section));
}

function inferProofArtifactRequested(statusRaw: string, nextPrompt: string, codexReport: string): boolean {
  return /proof artifact|command evidence|stax:collect|screenshot|visual proof|preflight|target validation|worktree|codex report/i.test(
    `${statusRaw}\n${nextPrompt}\n${codexReport}`
  );
}

function artifactKind(relativePath: string): string {
  if (relativePath.includes("proof")) return "proof";
  if (relativePath.includes("status")) return "status";
  if (relativePath.includes("next-codex-prompt")) return "next_prompt";
  if (relativePath.includes("visual")) return "visual";
  if (relativePath.includes("proof-surfaces")) return "proof_surface";
  return "sidecar_artifact";
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
