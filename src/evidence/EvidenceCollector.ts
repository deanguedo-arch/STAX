import fs from "node:fs/promises";
import path from "node:path";
import { CommandEvidenceStore } from "./CommandEvidenceStore.js";
import { collectLocalEvidence } from "./LocalEvidenceCollector.js";
import { RepoSummary } from "../workspace/RepoSummary.js";
import { WorkspaceContext } from "../workspace/WorkspaceContext.js";
import type { ResolvedWorkspaceContext } from "../workspace/WorkspaceContext.js";
import { WorkspaceStore } from "../workspace/WorkspaceStore.js";

export type CollectedEvidenceItem = {
  evidenceId: string;
  sourceType:
    | "file"
    | "trace"
    | "run"
    | "eval"
    | "test"
    | "lab_report"
    | "codex_report"
    | "workspace_doc"
    | "repo_summary"
    | "command_output";
  path?: string;
  command?: string;
  summary: string;
  confidence: "low" | "medium" | "high";
  createdAt: string;
};

export type EvidenceCollection = {
  collectionId: string;
  workspace: string;
  createdAt: string;
  items: CollectedEvidenceItem[];
};

export class EvidenceCollector {
  constructor(private rootDir = process.cwd()) {}

  async collect(input: { workspace?: string } = {}): Promise<{ path: string; collection: EvidenceCollection }> {
    let workspaceContext: ResolvedWorkspaceContext;
    try {
      workspaceContext = await new WorkspaceContext(this.rootDir).resolve({
        workspace: input.workspace,
        requireWorkspace: input.workspace === "current"
      });
    } catch {
      workspaceContext = { source: "none" };
    }
    const workspace = workspaceContext.workspace ?? input.workspace ?? "current";
    const createdAt = new Date().toISOString();
    const collectionId = `evidence_${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 6)}`;
    const local = await collectLocalEvidence(this.rootDir, { includeProjectDocs: true, includeModeMaturity: true });
    const items: CollectedEvidenceItem[] = [];
    if (local.latestRunFolder) {
      items.push({
        evidenceId: `${collectionId}_run`,
        sourceType: "run",
        path: local.latestRunFolder,
        summary: "Latest run folder discovered by read-only local evidence collection.",
        confidence: "high",
        createdAt
      });
      items.push({
        evidenceId: `${collectionId}_trace`,
        sourceType: "trace",
        path: path.join(local.latestRunFolder, "trace.json"),
        summary: "Trace path for the latest discovered run.",
        confidence: "high",
        createdAt
      });
    }
    if (local.latestEval) {
      items.push({
        evidenceId: `${collectionId}_eval`,
        sourceType: "eval",
        path: local.latestEval.path,
        command: "npm run rax -- eval or regression eval",
        summary: `Eval result total=${local.latestEval.total ?? "unknown"} passed=${local.latestEval.passed ?? "unknown"} failed=${local.latestEval.failed ?? "unknown"} passRate=${local.latestEval.passRate ?? "unknown"}.`,
        confidence: local.latestEval.failed === 0 && local.latestEval.criticalFailures === 0 ? "high" : "medium",
        createdAt
      });
    }
    for (const file of local.gitDiffNameOnly.slice(0, 50)) {
      items.push({
        evidenceId: `${collectionId}_file_${items.length}`,
        sourceType: "file",
        path: file,
        summary: "File currently appears in git diff name-only output.",
        confidence: "medium",
        createdAt
      });
    }
    for (const doc of local.projectDocs.filter((item) => item.exists)) {
      items.push({
        evidenceId: `${collectionId}_doc_${items.length}`,
        sourceType: "workspace_doc",
        path: doc.path,
        summary: "Project evidence document exists and was sampled.",
        confidence: "medium",
        createdAt
      });
    }
    if (workspaceContext.workspace) {
      const docs = await new WorkspaceStore(this.rootDir).readWorkspaceDocs(workspaceContext.workspace);
      for (const doc of docs.filter((item) => item.exists)) {
        items.push({
          evidenceId: `${collectionId}_workspace_doc_${items.length}`,
          sourceType: "workspace_doc",
          path: doc.path,
          summary: "Workspace evidence document exists and was sampled.",
          confidence: "medium",
          createdAt
        });
      }
    }
    if (workspaceContext.linkedRepoPath) {
      const summary = await new RepoSummary(workspaceContext.linkedRepoPath).summarize();
      items.push({
        evidenceId: `${collectionId}_repo_summary`,
        sourceType: "repo_summary",
        path: workspaceContext.linkedRepoPath,
        summary: summary.markdown.slice(0, 500),
        confidence: "medium",
        createdAt
      });
    }
    const commandEvidence = await new CommandEvidenceStore(this.rootDir).list();
    for (const command of commandEvidence.slice(-20)) {
      items.push({
        evidenceId: command.commandEvidenceId,
        sourceType: "command_output",
        path: path.join("evidence", "commands", command.createdAt.slice(0, 10), `${command.commandEvidenceId}.json`),
        command: command.command,
        summary: command.summary,
        confidence: command.success ? "high" : "medium",
        createdAt: command.createdAt
      });
    }
    const collection = { collectionId, workspace, createdAt, items };
    const dir = path.join(this.rootDir, "evidence", "collections");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${collectionId}.json`);
    await fs.writeFile(file, JSON.stringify(collection, null, 2), "utf8");
    return { path: path.relative(this.rootDir, file), collection };
  }

  async list(): Promise<EvidenceCollection[]> {
    const dir = path.join(this.rootDir, "evidence", "collections");
    try {
      const files = (await fs.readdir(dir)).filter((entry) => entry.endsWith(".json")).sort();
      return Promise.all(files.map(async (file) => JSON.parse(await fs.readFile(path.join(dir, file), "utf8")) as EvidenceCollection));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async show(id: string): Promise<EvidenceCollection | undefined> {
    const collections = await this.list();
    return collections.find((collection) => collection.collectionId === id || collection.items.some((item) => item.evidenceId === id));
  }
}
