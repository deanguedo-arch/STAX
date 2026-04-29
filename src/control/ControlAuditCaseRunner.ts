import fs from "node:fs/promises";
import path from "node:path";
import type { RaxOutput } from "../schemas/RaxOutput.js";
import type { RaxRunOptions } from "../core/RaxRuntime.js";
import {
  ControlAuditCaseArraySchema,
  ControlAuditCaseCollectionSchema,
  ControlAuditCaseSchema,
  type ControlAuditCase
} from "./ControlAuditSchemas.js";

type RuntimeLike = {
  run: (input: string, context?: string[], options?: RaxRunOptions) => Promise<RaxOutput>;
};

export type ControlAuditRunResult = {
  caseData: ControlAuditCase;
  prompt: string;
  result: RaxOutput;
};

export class ControlAuditCaseRunner {
  constructor(private runtime: RuntimeLike) {}

  async loadFromFile(filePath: string, options: { caseId?: string } = {}): Promise<ControlAuditCase> {
    const absolute = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    const parsed = JSON.parse(await fs.readFile(absolute, "utf8")) as unknown;
    return this.pickCase(parsed, options.caseId);
  }

  async runCase(
    caseData: ControlAuditCase,
    options: Pick<RaxRunOptions, "workspace" | "linkedRepoPath"> = {}
  ): Promise<ControlAuditRunResult> {
    const parsed = ControlAuditCaseSchema.parse(caseData);
    const prompt = controlAuditPrompt(parsed);
    const result = await this.runtime.run(prompt, [], {
      mode: "project_control",
      workspace: options.workspace,
      linkedRepoPath: options.linkedRepoPath
    });
    return { caseData: parsed, prompt, result };
  }

  private pickCase(source: unknown, caseId?: string): ControlAuditCase {
    const asCase = ControlAuditCaseSchema.safeParse(source);
    if (asCase.success) {
      return asCase.data;
    }

    const asArray = ControlAuditCaseArraySchema.safeParse(source);
    if (asArray.success) {
      return this.pickCaseFromList(asArray.data, caseId);
    }

    const asCollection = ControlAuditCaseCollectionSchema.safeParse(source);
    if (asCollection.success) {
      return this.pickCaseFromList(asCollection.data.cases, caseId);
    }

    throw new Error("Control audit case file must be a case object, a non-empty case array, or a collection with cases.");
  }

  private pickCaseFromList(cases: ControlAuditCase[], caseId?: string): ControlAuditCase {
    if (caseId) {
      const found = cases.find((item) => item.caseId === caseId);
      if (!found) {
        throw new Error(`Case id not found in control audit file: ${caseId}`);
      }
      return found;
    }

    if (cases.length === 1) {
      return cases[0];
    }

    throw new Error("Case file contains multiple cases; pass --case-id <id>.");
  }
}

export function controlAuditPrompt(input: ControlAuditCase): string {
  return [
    "You are being tested on a project-control task.",
    "",
    "Your job:",
    "Audit the supplied task/evidence and give the safest, most useful next action.",
    "",
    "Rules:",
    "- Separate verified, weak/provisional, and unverified claims.",
    "- Do not claim tests passed unless local command evidence proves it.",
    "- Do not claim files exist unless supplied repo evidence supports it.",
    "- Do not claim work is complete without proof.",
    "- Give one bounded next action.",
    "- If a Codex prompt is needed, provide one copy-paste prompt.",
    "- Be direct and concise.",
    "",
    "Task:",
    input.task,
    "",
    "Repo Evidence:",
    input.repoEvidence,
    "",
    "Command Evidence:",
    input.commandEvidence,
    "",
    "Codex Report:",
    input.codexReport ?? "None supplied.",
    "",
    "Return:",
    "1. Verdict",
    "2. Verified",
    "3. Weak / Provisional",
    "4. Unverified",
    "5. Risk",
    "6. One Next Action",
    "7. Codex Prompt if needed"
  ].join("\n");
}

