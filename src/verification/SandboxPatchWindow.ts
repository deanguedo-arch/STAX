import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { redactProofText } from "../audit/ProofRedactor.js";
import { matchesGlob } from "./AutonomyWindow.js";
import { SandboxGuard } from "./SandboxGuard.js";
import {
  SandboxPatchEvidenceSchema,
  SandboxPatchRunInputSchema,
  SandboxPatchWindowResultSchema,
  type SandboxPatchChangedFile,
  type SandboxPatchEvidence,
  type SandboxPatchRunInput,
  type SandboxPatchWindowResult
} from "./SandboxPatchWindowSchemas.js";

export class SandboxPatchWindow {
  constructor(private rootDir = process.cwd()) {}

  async run(input: SandboxPatchRunInput): Promise<SandboxPatchWindowResult> {
    const parsed = SandboxPatchRunInputSchema.parse(input);
    if (!parsed.humanApprovedPatch) {
      return result({
        status: "approval_required",
        parsed,
        changedFiles: [],
        blockingReasons: ["Human approval is required before sandbox patching."],
        summary: "Sandbox patch window did not run because approval is missing."
      });
    }

    const guard = new SandboxGuard();
    const verified = await guard.verify({
      workspace: parsed.workspace,
      packetId: parsed.packet.packetId,
      sourceRepoPath: parsed.linkedRepoPath,
      sandboxPath: parsed.sandboxPath
    });
    if (!verified.allowedForCommandWindow) {
      return result({
        status: "blocked",
        parsed,
        changedFiles: [],
        manifestPath: verified.manifestPath,
        blockingReasons: [`Sandbox must verify before patching: ${verified.blockingReasons.join("; ")}`],
        summary: "Sandbox patch window blocked because sandbox integrity did not verify."
      });
    }

    const boundaryBlockers = this.boundaryBlockers(parsed);
    if (boundaryBlockers.length) {
      return result({
        status: "blocked",
        parsed,
        changedFiles: [],
        manifestPath: verified.manifestPath,
        blockingReasons: boundaryBlockers,
        summary: "Sandbox patch window blocked before writing files."
      });
    }

    const changedFiles: SandboxPatchChangedFile[] = [];
    const diffs: string[] = [];
    for (const operation of parsed.operations) {
      const relativePath = normalizeRelativePath(operation.filePath);
      const absolutePath = path.join(path.resolve(parsed.sandboxPath), relativePath);
      const before = await fs.readFile(absolutePath, "utf8").catch((error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      });
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, operation.content, "utf8");
      const after = await fs.readFile(absolutePath, "utf8");
      changedFiles.push({
        filePath: relativePath,
        beforeHash: before === undefined ? undefined : sha256(before),
        afterHash: sha256(after),
        beforeSizeBytes: before === undefined ? undefined : Buffer.byteLength(before),
        afterSizeBytes: Buffer.byteLength(after),
        created: before === undefined
      });
      diffs.push(formatDiff(relativePath, before, after));
    }

    const evidence = await this.recordPatchEvidence({
      parsed,
      changedFiles,
      diffText: diffs.join("\n")
    });
    const refreshed = await guard.refreshIntegrityAfterPatch({
      workspace: parsed.workspace,
      packetId: parsed.packet.packetId,
      sourceRepoPath: parsed.linkedRepoPath,
      sandboxPath: parsed.sandboxPath,
      patchEvidenceId: evidence.patchEvidenceId,
      changedFiles: changedFiles.map((file) => file.filePath),
      diffPath: evidence.diffPath
    });
    if (!refreshed.allowedForCommandWindow) {
      return result({
        status: "blocked",
        parsed,
        changedFiles,
        patchEvidenceId: evidence.patchEvidenceId,
        diffPath: evidence.diffPath,
        manifestPath: refreshed.manifestPath,
        blockingReasons: [`Sandbox patch was written but integrity refresh failed: ${refreshed.blockingReasons.join("; ")}`],
        summary: "Sandbox patch window stopped because post-patch integrity refresh failed."
      });
    }

    return result({
      status: "patched",
      parsed,
      changedFiles,
      patchEvidenceId: evidence.patchEvidenceId,
      diffPath: evidence.diffPath,
      manifestPath: refreshed.manifestPath,
      summary: "Sandbox-only patch applied, diff evidence recorded, and sandbox integrity manifest refreshed."
    });
  }

  private boundaryBlockers(parsed: ReturnType<typeof SandboxPatchRunInputSchema.parse>): string[] {
    const blockers: string[] = [];
    const sandboxPath = path.resolve(parsed.sandboxPath);
    const linkedRepoPath = path.resolve(parsed.linkedRepoPath);
    if (samePath(sandboxPath, linkedRepoPath)) blockers.push("Sandbox patch window cannot write to the linked repo path.");
    if (isInside(sandboxPath, linkedRepoPath)) blockers.push("Sandbox patch window cannot write inside the linked repo path.");
    for (const operation of parsed.operations) {
      const filePath = normalizeRelativePath(operation.filePath);
      if (!isSafeRelativePath(operation.filePath)) {
        blockers.push(`${operation.filePath} is not a safe sandbox-relative path.`);
        continue;
      }
      if (parsed.packet.forbiddenFileGlobs.some((glob) => matchesGlob(filePath, glob))) {
        blockers.push(`${filePath} matches a forbidden file boundary.`);
      }
      if (!parsed.packet.allowedFileGlobs.some((glob) => matchesGlob(filePath, glob))) {
        blockers.push(`${filePath} is outside the allowed sandbox patch window.`);
      }
      if (filePath === "package.json" && !operation.justification) {
        blockers.push("package.json patching requires an explicit justification.");
      }
    }
    return blockers;
  }

  private async recordPatchEvidence(input: {
    parsed: ReturnType<typeof SandboxPatchRunInputSchema.parse>;
    changedFiles: SandboxPatchChangedFile[];
    diffText: string;
  }): Promise<SandboxPatchEvidence> {
    const createdAt = new Date().toISOString();
    const date = createdAt.slice(0, 10);
    const patchEvidenceId = `patch-ev-${createdAt.replace(/[^0-9]/g, "").slice(0, 17)}-${Math.random().toString(36).slice(2, 8)}`;
    const dir = path.join(this.rootDir, "evidence", "patches", date);
    await fs.mkdir(dir, { recursive: true });
    const diffPath = path.join("evidence", "patches", date, `${patchEvidenceId}.diff.txt`);
    const redactedDiff = redactProofText(input.diffText).text;
    await fs.writeFile(path.join(this.rootDir, diffPath), redactedDiff, "utf8");
    const evidence = SandboxPatchEvidenceSchema.parse({
      patchEvidenceId,
      packetId: input.parsed.packet.packetId,
      workspace: input.parsed.workspace,
      sandboxPath: path.resolve(input.parsed.sandboxPath),
      linkedRepoPath: path.resolve(input.parsed.linkedRepoPath),
      changedFiles: input.changedFiles,
      diffPath,
      createdAt,
      hash: sha256(JSON.stringify({
        packetId: input.parsed.packet.packetId,
        changedFiles: input.changedFiles,
        diff: redactedDiff
      }))
    });
    await fs.writeFile(path.join(dir, `${patchEvidenceId}.json`), JSON.stringify(evidence, null, 2), "utf8");
    return evidence;
  }
}

function result(input: {
  status: SandboxPatchWindowResult["status"];
  parsed: ReturnType<typeof SandboxPatchRunInputSchema.parse>;
  changedFiles: SandboxPatchChangedFile[];
  patchEvidenceId?: string;
  diffPath?: string;
  manifestPath?: string;
  blockingReasons?: string[];
  summary: string;
}): SandboxPatchWindowResult {
  return SandboxPatchWindowResultSchema.parse({
    status: input.status,
    packetId: input.parsed.packet.packetId,
    mutationStatus: input.status === "patched" ? "sandbox_only" : "none",
    changedFiles: input.changedFiles,
    patchEvidenceId: input.patchEvidenceId,
    diffPath: input.diffPath,
    manifestPath: input.manifestPath,
    postPatchRequiredCommands: input.parsed.packet.checkpointCommands,
    blockingReasons: input.blockingReasons ?? [],
    summary: input.summary
  });
}

function formatDiff(filePath: string, before: string | undefined, after: string): string {
  return [
    `diff --stax a/${filePath} b/${filePath}`,
    before === undefined ? "--- /dev/null" : `--- a/${filePath}`,
    `+++ b/${filePath}`,
    "@@",
    ...(before ?? "").split(/\r?\n/).map((line) => `-${line}`),
    ...after.split(/\r?\n/).map((line) => `+${line}`),
    ""
  ].join("\n");
}

function normalizeRelativePath(filePath: string): string {
  return filePath.trim().replace(/\\/g, "/").replace(/^\.?\//, "");
}

function isSafeRelativePath(filePath: string): boolean {
  const normalized = normalizeRelativePath(filePath);
  return !path.isAbsolute(filePath)
    && normalized !== "."
    && normalized !== ".."
    && !normalized.startsWith("../")
    && !normalized.includes("/../")
    && !normalized.endsWith("/..");
}

function samePath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
