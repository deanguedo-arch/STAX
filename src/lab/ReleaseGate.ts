import fs from "node:fs/promises";
import path from "node:path";
import {
  PatchProposalSchema,
  ReleaseGateResultSchema,
  VerificationResultSchema,
  ensureLabDirs,
  labId,
  relativeLabPath,
  resolveLabPath,
  type PatchProposal,
  type ReleaseGateResult,
  type VerificationResult
} from "./LearningWorker.js";

export class ReleaseGate {
  constructor(private rootDir = process.cwd()) {}

  async evaluate(input: {
    patch: PatchProposal | string;
    verification?: VerificationResult | string;
  }): Promise<{ path: string; result: ReleaseGateResult }> {
    await ensureLabDirs(this.rootDir);
    const patch =
      typeof input.patch === "string"
        ? PatchProposalSchema.parse(JSON.parse(await fs.readFile(resolveLabPath(this.rootDir, input.patch), "utf8")))
        : PatchProposalSchema.parse(input.patch);
    const verification =
      typeof input.verification === "string"
        ? VerificationResultSchema.parse(JSON.parse(await fs.readFile(resolveLabPath(this.rootDir, input.verification), "utf8")))
        : input.verification
          ? VerificationResultSchema.parse(input.verification)
          : undefined;
    const reasons = this.reasons(patch, verification);
    const result = ReleaseGateResultSchema.parse({
      gateId: labId("gate"),
      patchId: patch.patchId,
      status: this.status(patch, verification, reasons),
      reasons,
      createdAt: new Date().toISOString()
    });
    const file = path.join(this.rootDir, "learning", "lab", "release-gates", `${result.gateId}.json`);
    await fs.writeFile(file, JSON.stringify(result, null, 2), "utf8");
    return { path: relativeLabPath(this.rootDir, file), result };
  }

  private reasons(patch: PatchProposal, verification?: VerificationResult): string[] {
    const reasons: string[] = [];
    const touched = [...patch.filesToInspect, ...patch.filesToModify].join("\n").toLowerCase();
    const riskyPrompt = patch.codexPrompt
      .toLowerCase()
      .split("\n")
      .filter((line) => !/\b(do not|never|cannot)\b/.test(line))
      .join("\n");
    if (verification && !verification.passed) reasons.push("verification failed");
    if (patch.testsToAdd.length === 0) reasons.push("patch lacks tests");
    if (patch.rollbackPlan.length === 0) reasons.push("patch lacks rollback plan");
    if (/shell\s*=\s*allowed|filewrite\s*=\s*allowed|web\s*=\s*allowed|git push|auto-approve|auto-promote/.test(riskyPrompt)) {
      reasons.push("patch appears to weaken tool or approval safety");
    }
    if (/agents\.md|config|policy|schema|mode|tool/.test(touched) || patch.risk === "high") {
      reasons.push("human review required for policy/schema/mode/tool/config or high-risk change");
    }
    if (reasons.length === 0) reasons.push("candidate-only patch proposal with tests and rollback");
    return reasons;
  }

  private status(
    patch: PatchProposal,
    verification: VerificationResult | undefined,
    reasons: string[]
  ): ReleaseGateResult["status"] {
    if (
      verification?.passed === false ||
      reasons.includes("patch lacks tests") ||
      reasons.includes("patch lacks rollback plan") ||
      reasons.includes("patch appears to weaken tool or approval safety")
    ) {
      return "blocked";
    }
    if (patch.risk === "high" || reasons.some((reason) => reason.includes("human review required"))) {
      return "needs_human";
    }
    return "safe_to_review";
  }
}
