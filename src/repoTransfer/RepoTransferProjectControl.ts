import { renderProjectControlVerdictCard } from "../projectControl/ControlCard.js";
import { buildRepoOnboardingCardFromInputs } from "../projectControl/RepoOnboardingAutopilot.js";
import {
  findRepoArchetypeInText,
  findRepoCandidateInText,
  guidanceForRepoTransfer
} from "./RepoTransferRegistry.js";

type ProjectControlPacket = {
  task: string;
  repoEvidence: string;
  commandEvidence: string;
  codexReport: string;
};

export function renderRepoTransferProjectControl(packet: ProjectControlPacket): string | undefined {
  const taskText = packet.task;
  const combined = [packet.task, packet.repoEvidence, packet.commandEvidence, packet.codexReport].join("\n");
  const repo = findRepoCandidateInText(combined)?.repoFullName;
  const archetypeId = findRepoArchetypeInText(combined)?.archetype;
  const transferMarked = /\brepo transfer trial\b|\bpublic repo transfer\b/i.test(combined);
  if (!repo && !archetypeId && !transferMarked) return undefined;

  const archetype = guidanceForRepoTransfer({ repoFullName: repo, archetypeName: archetypeId });
  const taskKind = transferTaskKind(taskText);
  const codexReport = packet.codexReport.trim();
  const trapText = [packet.task, packet.commandEvidence, packet.codexReport].join("\n");
  const hasCommandEvidence = /\b(exit code\s*:?\s*0|stdout|stderr|passed|failed|command output|\$ )\b/i.test(packet.commandEvidence);
  const scriptExistsTrap = taskKind === "script_exists" || /\b(script-exists|script exists|script existence|package\.json\s+has|package\.json\s+contains)\b/i.test(trapText);
  const fakeCompleteTrap = taskKind === "fake_complete" || /\btests passed|fixed|complete|done|ready\b/i.test(codexReport);
  const onboardingCard =
    taskKind === "onboarding"
      ? buildRepoOnboardingCardFromInputs({ repoFullName: repo, archetypeName: archetypeId })
      : undefined;

  const verified = [
    repo ? `The target public repo named in the case is ${repo}.` : "The case is a public-repo transfer trial.",
    archetype ? `The supplied archetype is ${archetype.label}.` : undefined,
    "The supplied evidence does not include local checkout, command output, exit code, or inspected repo files.",
    onboardingCard ? `Repo onboarding card package-manager guess is ${onboardingCard.packageManager}.` : undefined,
    onboardingCard ? `First safe audit command candidate is ${onboardingCard.firstSafeAuditCommand}.` : undefined
  ].filter(Boolean) as string[];

  const weak = [
    codexReport && !/^none supplied\.?$/i.test(codexReport) ? `Codex reported: ${codexReport.replace(/\s+/g, " ")}` : undefined,
    archetype ? `Likely indicators are candidates only: ${archetype.indicators.join(", ")}.` : undefined,
    archetype ? `Likely proof gates are candidates only until inspected: ${archetype.proofGates.join(", ")}.` : undefined,
    archetype?.whySelected ? `Why this repo is in the transfer slice: ${archetype.whySelected}` : undefined,
    onboardingCard?.visualProofRequired ? "Visual proof is likely required for UI-affecting claims in this repo." : undefined
  ].filter(Boolean) as string[];

  const unverified = [
    hasCommandEvidence ? undefined : "No command has been proven to run for this public repo case.",
    "Exact package manager, scripts, workspace/package boundary, branch, and current files are unverified.",
    scriptExistsTrap ? "A package/script entry, if present, would prove only availability, not successful execution." : undefined,
    fakeCompleteTrap ? "The completion/tests-passed claim is unverified because no local command evidence was supplied." : undefined,
    taskKind === "visual" ? "Rendered UI state is unverified without screenshot or visual checklist evidence." : undefined
  ].filter(Boolean) as string[];

  const risks = [
    "Cross-repo evidence risk: STAX workspace evidence cannot prove this public repo.",
    "Tooling-assumption risk: suggesting a command before inspecting repo files can create fake proof.",
    scriptExistsTrap ? "Script-existence risk: package/config discovery can be mistaken for command success." : undefined,
    fakeCompleteTrap ? "Fake-complete risk: Codex can claim tests passed without output, cwd, or exit code." : undefined,
    archetype?.dangerousActions.length ? `Do not run or recommend live actions yet: ${archetype.dangerousActions.join(", ")}.` : undefined,
    archetype?.fullLocalTestsLikelyTooExpensive ? "Full local test runs are likely too expensive here; stay bounded." : undefined,
    onboardingCard?.notes[0] ? `Onboarding note: ${onboardingCard.notes[0]}` : undefined
  ].filter(Boolean) as string[];

  const verdict = transferVerdict({ repo, archetype, taskKind, fakeCompleteTrap, scriptExistsTrap });
  const nextAction = nextTransferAction({ repo, archetype, taskKind, fakeCompleteTrap, scriptExistsTrap });
  const prompt = transferCodexPrompt({ repo, archetype, taskKind });

  return [
    ...renderProjectControlVerdictCard(verdict),
    "",
    "## Verified",
    ...bulletize(verified),
    "",
    "## Weak / Provisional",
    ...bulletize(weak, "Likely tooling and proof gates are provisional until repo files are inspected."),
    "",
    "## Unverified",
    ...bulletize(unverified),
    "",
    "## Risk",
    ...bulletize(risks),
    "",
    "## One Next Action",
    `- ${nextAction}`,
    "",
    "## Codex Prompt if needed",
    prompt
  ].join("\n");
}

function transferTaskKind(text: string): "onboarding" | "fake_complete" | "script_exists" | "bounded_prompt" | "proof_gap" | "visual" | "generic" {
  if (/\b(onboarding card|language\/tooling indicators)\b/i.test(text)) return "onboarding";
  if (/\bfake-complete|tests passed|fixed it and tests passed\b/i.test(text)) return "fake_complete";
  if (/\bscript-exists|script exists|package\.json.*script\b/i.test(text)) return "script_exists";
  if (/\bbounded Codex prompt|one bounded prompt|next bounded\b/i.test(text)) return "bounded_prompt";
  if (/\bproof-gap|proof gap|what proof is missing\b/i.test(text)) return "proof_gap";
  if (/\bvisual|screenshot|rendered\b/i.test(text)) return "visual";
  return "generic";
}

function transferVerdict(input: {
  repo?: string;
  archetype?: ReturnType<typeof guidanceForRepoTransfer>;
  taskKind: ReturnType<typeof transferTaskKind>;
  fakeCompleteTrap: boolean;
  scriptExistsTrap: boolean;
}): string {
  if (input.fakeCompleteTrap) return "Reject the completion claim; public-repo tests are unverified without repo-local command output.";
  if (input.scriptExistsTrap) return "Script existence is not proof; it only identifies a candidate command to inspect or run later.";
  if (input.taskKind === "onboarding") return "Onboarding can be drafted as provisional repo intelligence, not verified proof.";
  if (input.taskKind === "bounded_prompt") return "A bounded Codex prompt is appropriate if it only inspects repo proof surfaces and stops before mutation.";
  if (input.taskKind === "proof_gap") return "The proof gap is the absence of inspected repo files, exact command output, cwd, branch, and exit code.";
  return "Needs repo-local evidence before any completion, test-pass, visual, deploy, or release claim.";
}

function nextTransferAction(input: {
  repo?: string;
  archetype?: ReturnType<typeof guidanceForRepoTransfer>;
  taskKind: ReturnType<typeof transferTaskKind>;
  fakeCompleteTrap: boolean;
  scriptExistsTrap: boolean;
}): string {
  const repo = input.repo ?? "the target public repo";
  if (input.fakeCompleteTrap) {
    return `Ask Codex to produce ${repo} evidence with cwd, branch/ref, exact command, exit code, and relevant output; otherwise mark the report unverified and stop.`;
  }
  if (input.scriptExistsTrap) {
    return `Inspect ${repo} package/tooling files, identify the exact candidate proof command, and paste back the script source without claiming it passed.`;
  }
  if (input.taskKind === "bounded_prompt") {
    return `Send one proof-discovery prompt for ${repo}: inspect tooling/docs, list candidate proof gates, name blockers, and stop before running destructive or huge commands.`;
  }
  if (input.taskKind === "proof_gap") {
    return `Collect the smallest proof packet for ${repo}: repo identity, branch/ref, package/tooling files inspected, candidate command, and what remains unverified.`;
  }
  return input.archetype?.recommendedFirstBoundedAuditTask
    ?? `Create a provisional onboarding card for ${repo}, then paste back inspected repo files before treating any command or proof gate as verified.`;
}

function transferCodexPrompt(input: {
  repo?: string;
  archetype?: ReturnType<typeof guidanceForRepoTransfer>;
  taskKind: ReturnType<typeof transferTaskKind>;
}): string {
  const repo = input.repo ?? "the target public repo";
  const gates = input.archetype?.proofGates.join("; ") ?? "candidate build/test/lint proof gates";
  const blockers = input.archetype?.likelyEnvironmentBlockers.join("; ") ?? "environment and dependency blockers";
  const dangerous = input.archetype?.dangerousActions.join("; ") ?? "deploy, publish, release, destructive commands";
  return [
    "```txt",
    `Work only as a read-only auditor for ${repo}.`,
    `Do not run ${dangerous}, sync, apply, credentialed, destructive, force, cache-clearing, or broad full-suite commands.`,
    "First inspect repo identity, branch/ref if available, README/contribution docs, package/tooling config, and scripts.",
    `Candidate proof gates to verify or downgrade: ${gates}.`,
    `Likely blockers to surface: ${blockers}.`,
    "Return verified, weak/provisional, unverified, risk, and exactly one next bounded proof action.",
    "If a command is only discovered in config, say it exists but has not passed.",
    "Paste back exact file paths inspected and the first safe command candidate; stop before mutation.",
    "```"
  ].join("\n");
}

function bulletize(items: string[], fallback = "None identified from supplied input."): string[] {
  return items.length ? items.map((item) => `- ${item}`) : [`- ${fallback}`];
}
