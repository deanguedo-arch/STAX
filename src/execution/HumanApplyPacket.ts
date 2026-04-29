import path from "node:path";
import {
  HumanApplyPacketInputSchema,
  HumanApplyPacketSchema,
  type HumanApplyPacket,
  type HumanApplyPacketInput,
  type HumanApplyRecommendation
} from "./HumanApplyPacketSchemas.js";

export class HumanApplyPacketBuilder {
  build(input: HumanApplyPacketInput): HumanApplyPacket {
    const parsed = HumanApplyPacketInputSchema.parse(input);
    const recommendation = recommend(parsed);
    const risks = risksFor(parsed);
    return HumanApplyPacketSchema.parse({
      status: parsed.status,
      packetId: parsed.packetId,
      workspace: parsed.workspace,
      recommendation,
      requiresHumanApproval: true,
      appliedToRealRepo: false,
      sandboxPath: path.resolve(parsed.sandboxPath),
      linkedRepoPath: path.resolve(parsed.linkedRepoPath),
      changedFiles: parsed.changedFiles,
      patchDiffPath: parsed.patchDiffPath,
      patchEvidenceId: parsed.patchEvidenceId,
      commandResults: parsed.commandResults,
      commandEvidenceIds: parsed.commandEvidenceIds,
      firstRemainingFailure: parsed.firstRemainingFailure,
      blockingReasons: parsed.blockingReasons,
      risks,
      markdown: formatMarkdown({
        ...parsed,
        recommendation,
        risks
      })
    });
  }
}

function recommend(input: ReturnType<typeof HumanApplyPacketInputSchema.parse>): HumanApplyRecommendation {
  if (input.forbiddenDiff) return "do_not_apply";
  if (input.missingCommandEvidence || !input.commandEvidenceIds.length) return "needs_review";
  if (input.status === "blocked") return "do_not_apply";
  if (input.status === "sandbox_failed") return "do_not_apply";
  if (!input.patchDiffPath || !input.changedFiles.length) return "needs_review";
  return "apply";
}

function risksFor(input: ReturnType<typeof HumanApplyPacketInputSchema.parse>): string[] {
  const risks: string[] = [];
  if (input.status !== "sandbox_verified") risks.push("Sandbox proof did not verify the patch.");
  if (input.forbiddenDiff) risks.push("Diff touched a forbidden file boundary.");
  if (input.missingCommandEvidence || !input.commandEvidenceIds.length) risks.push("Command proof is missing or incomplete.");
  if (!input.patchDiffPath || !input.changedFiles.length) risks.push("No sandbox diff is available to apply.");
  if (input.firstRemainingFailure) risks.push(`First remaining failure: ${input.firstRemainingFailure}`);
  if (!risks.length) risks.push("Real repo apply remains unverified until Dean approves and applies the sandbox diff.");
  return risks;
}

function formatMarkdown(input: ReturnType<typeof HumanApplyPacketInputSchema.parse> & {
  recommendation: HumanApplyRecommendation;
  risks: string[];
}): string {
  const fileLines = input.changedFiles.length
    ? input.changedFiles.map((file) => `- ${file.filePath} (${file.created ? "created" : "modified"})`)
    : ["- none"];
  const commandLines = input.commandResults.length
    ? input.commandResults.map((item) => `- ${item.command}: ${item.status}${item.exitCode === undefined ? "" : ` (${item.exitCode})`}${item.evidenceId ? ` evidence=${item.evidenceId}` : ""}`)
    : ["- none"];
  const blockerLines = input.blockingReasons.length
    ? input.blockingReasons.map((reason) => `- ${reason}`)
    : ["- none"];
  return [
    "## Apply Decision Packet",
    `Status: ${input.status}`,
    "",
    "## Sandbox Diff",
    ...fileLines,
    `Diff path: ${input.patchDiffPath ?? "missing"}`,
    "",
    "## Proof Commands",
    ...commandLines,
    "",
    "## Risk",
    ...input.risks.map((risk) => `- ${risk}`),
    "",
    "## Blocking Reasons",
    ...blockerLines,
    "",
    "## Recommendation",
    input.recommendation,
    "",
    "## Human Decision Needed",
    "Approve applying this sandbox diff to the real repo, or stop here. STAX has not applied anything to the real repo."
  ].join("\n");
}
