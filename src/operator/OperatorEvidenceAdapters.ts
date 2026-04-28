import { EvidenceRequestBuilder } from "../evidence/EvidenceRequestBuilder.js";
import type { OperationExecutionResult, OperationPlan } from "./OperationSchemas.js";

export type FailedCommandEvidence = {
  command: string;
  source: "supplied" | "stored";
};

export function evidenceRequestFor(plan: OperationPlan, result: OperationExecutionResult) {
  return new EvidenceRequestBuilder().build({
    task: plan.originalInput,
    repo: plan.workspace,
    reason: "missing_evidence",
    availableEvidence: [
      result.result,
      ...result.evidenceChecked,
      ...result.risks,
      ...result.nextAllowedActions
    ].join("\n")
  });
}

export function hasTestsOrScripts(result: OperationExecutionResult): boolean {
  return result.evidenceChecked.some((item) => /^repo-(test|script):/.test(item));
}

export function scriptNames(result: OperationExecutionResult): string[] {
  return result.evidenceChecked
    .filter((item) => item.startsWith("repo-script:"))
    .map((item) => item.replace("repo-script:", ""))
    .filter(Boolean);
}

export function testFiles(result: OperationExecutionResult): string[] {
  return result.evidenceChecked
    .filter((item) => item.startsWith("repo-test:"))
    .map((item) => item.replace("repo-test:", ""))
    .filter(Boolean);
}

export function testCommand(result: OperationExecutionResult, originalInput = ""): string {
  const scripts = scriptNames(result);
  const supplied = suppliedNpmRunScripts(originalInput);
  for (const script of storedNpmRunScripts(result)) supplied.add(script);
  if (scripts.includes("test") && !supplied.has("test")) return "npm test";
  const testScript = scripts.find((script) => /test/i.test(script) && !supplied.has(script)) ||
    scripts.find((script) => /test/i.test(script));
  if (testScript) return `npm run ${testScript}`;
  const proofScript = scripts.find((script) => /typecheck|check|build|lint|ci/i.test(script) && !supplied.has(script)) ||
    scripts.find((script) => /typecheck|check|build|lint|ci/i.test(script)) ||
    scripts.find((script) => !supplied.has(script)) ||
    scripts[0];
  return proofScript ? `npm run ${proofScript}` : "npm test";
}

export function operatingProofCommand(result: OperationExecutionResult, originalInput = ""): string {
  const scripts = scriptNames(result);
  const supplied = suppliedNpmRunScripts(originalInput);
  for (const script of storedNpmRunScripts(result)) supplied.add(script);
  if (scripts.includes("typecheck") && !supplied.has("typecheck")) return "npm run typecheck";
  return testCommand(result, originalInput);
}

export function boundedPromptCommand(result: OperationExecutionResult): string | undefined {
  const match = result.result.match(/## Bounded Codex Prompt Candidate[\s\S]*?## Commands To Run\s*\n-\s*([^\n]+)/);
  return match?.[1]?.trim();
}

export function repoPath(result: OperationExecutionResult): string | undefined {
  return result.evidenceChecked.find((item) => item.startsWith("RepoPath: "))?.replace("RepoPath: ", "");
}

export function isOperatingStateQuestion(plan: OperationPlan): boolean {
  return plan.reasonCodes.some((code) =>
    code === "repo_operating_state_question" ||
    code === "workspace_operating_state_question" ||
    code === "repo_risk_question" ||
    code === "workspace_risk_question"
  );
}

export function operatingStateAnswer(result: OperationExecutionResult, foundTestsOrScripts: boolean): string {
  const risks = sectionItems(result.result, "Risks");
  const missingEvidence = sectionItems(result.result, "Missing Evidence");
  const operationalFiles = sectionItems(result.result, "Operational Files Checked");
  const gitStatus = gitStatusBlock(result.result);
  const testHonesty = foundTestsOrScripts ? " Tests/scripts were found, but STAX did not run them, so pass/fail is unknown." : "";
  const evidenceSuffix = [
    gitStatus && !hasChangedFiles(gitStatus) && !branchDrift(gitStatus) ? "git status is clean" : undefined,
    operationalFiles.length ? `operational docs inspected (${operationalFiles.slice(0, 2).join(", ")})` : undefined
  ].filter(Boolean).join("; ");

  const gitRisk = gitStatusRisk(gitStatus);
  if (gitRisk) {
    return `${gitRisk}${testHonesty}${evidenceSuffix ? ` Verified context: ${evidenceSuffix}.` : ""}`;
  }

  const lead = highestOperatingRisk(risks, missingEvidence);
  if (lead) {
    return `${lead}${testHonesty}${evidenceSuffix ? ` Verified context: ${evidenceSuffix}.` : ""}`;
  }

  return `No single operational failure was verified from read-only evidence. Current verified state: ${evidenceSuffix || "repo evidence was inspected read-only"}; the remaining unknown is command/test pass-fail because STAX did not run the linked repo.${testHonesty}`;
}

export function syncBoundaryStep(result: OperationExecutionResult): string | undefined {
  const gitStatus = gitStatusBlock(result.result);
  if (!gitStatus) return undefined;
  const firstLine = gitStatus.split(/\r?\n/)[0] ?? "";
  if (/\[behind\s+\d+\]/i.test(firstLine)) {
    return `Ask for human approval to pull or otherwise sync ${repoPath(result) ?? "the target repo"} with origin before making repo-health claims; paste back the approval decision.`;
  }
  if (/\[(?:ahead|diverged)[^\]]*\]/i.test(firstLine)) {
    return `Ask for human approval to reconcile branch drift in ${repoPath(result) ?? "the target repo"} before making repo-health claims; paste back the approval decision.`;
  }
  return undefined;
}

export function renderedPreviewProofNeed(plan: OperationPlan): boolean {
  return /\bsports\s*wellness|sportswellness|smart goals?|checkmark|check mark|rendered preview|text fit|symmetrical borders?\b/i.test(plan.originalInput) &&
    /\b(rendered|preview|screenshot|visual|containment|fit|box|border|checkmark|check mark)\b/i.test(plan.originalInput);
}

export function commandEvidenceStatements(input: string): string[] {
  const statements = new Set<string>();
  const patterns = [
    /\bnpm run ([a-z0-9:_-]+)\s+(passed|failed)(?:\s+\d+\s*\/\s*\d+)?\b/gi,
    /\bnpm test\s+(passed|failed)\b/gi,
    /\bnpx tsx --test\s+(.+?)\s+passed\s+(\d+\s*\/\s*\d+)?(?=;|\.|$)/gi
  ];
  for (const pattern of patterns) {
    for (const match of input.matchAll(pattern)) {
      if (match[0]) statements.add(match[0].trim().replace(/\s+/g, " "));
    }
  }
  return Array.from(statements);
}

export function storedCommandEvidenceStatements(result: OperationExecutionResult): string[] {
  return result.evidenceChecked
    .map((item) => item.match(/^command-evidence:[^:]+:(.+):(passed|failed|partial|unknown):(human_pasted_command_output|codex_reported_command_output|local_stax_command_output)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => `${match[1]} ${match[2]}`);
}

export function summarizeCommandEvidence(statements: string[]): string {
  const unique = Array.from(new Set(statements));
  if (unique.length <= 4) return unique.join("; ");
  const passed = unique.filter((item) => /\bpassed$/i.test(item)).length;
  const failed = unique.filter((item) => /\bfailed$/i.test(item)).length;
  const unknown = unique.length - passed - failed;
  const examples = unique.slice(0, 3).join("; ");
  return `${unique.length} stored command result(s) (${passed} passed, ${failed} failed, ${unknown} partial/unknown), including ${examples}`;
}

export function failedCommandEvidence(plan: OperationPlan, result: OperationExecutionResult): FailedCommandEvidence | undefined {
  const suppliedRun = Array.from(plan.originalInput.matchAll(/\b(npm run [a-z0-9:_-]+|npm test|npx tsx --test\s+.+?)\s+failed\b/gi))
    .map((match) => match[1]?.trim().replace(/\s+/g, " "))
    .filter((command): command is string => Boolean(command))[0];
  if (suppliedRun) {
    return {
      command: suppliedRun,
      source: "supplied"
    };
  }

  for (const item of result.evidenceChecked) {
    const match = item.match(/^command-evidence:[^:]+:(.+):failed:(human_pasted_command_output|codex_reported_command_output|local_stax_command_output)$/);
    if (match?.[1]) {
      return {
        command: match[1],
        source: "stored"
      };
    }
  }
  return undefined;
}

export function dependencyRepairBlocker(plan: OperationPlan, result: OperationExecutionResult): string | undefined {
  const haystack = [
    plan.originalInput,
    result.result,
    ...result.risks,
    ...result.evidenceChecked
  ].join("\n");
  if (/@rollup\/rollup-darwin-arm64/i.test(haystack)) return "@rollup/rollup-darwin-arm64 missing";
  if (/\boptional dependency\b/i.test(haystack) && /\brollup\b/i.test(haystack)) return "Rollup optional dependency missing";
  if (/\bCannot find module\b/i.test(haystack) && /\bnode_modules\b/i.test(haystack)) return "node_modules dependency resolution failure";
  return undefined;
}

export function dependencyInspectionComplete(plan: OperationPlan, result: OperationExecutionResult): boolean {
  const haystack = [
    plan.originalInput,
    result.result,
    ...result.evidenceChecked
  ].join("\n");
  return /\bnpm ls\s+@rollup\/rollup-darwin-arm64\s+rollup\s+vite\b/i.test(haystack) &&
    /\b(exited\s+0|exit code\s+0|passed)\b/i.test(haystack) &&
    /\b(did not list|not listed|absent|missing|not present)\b/i.test(haystack);
}

export function verificationDebtCommand(result: OperationExecutionResult): string | undefined {
  return result.evidenceChecked
    .find((item) => item.startsWith("verification-debt:"))
    ?.match(/^verification-debt:(.+):open$/)?.[1];
}

export function matchResultLine(result: string, pattern: RegExp): string | undefined {
  return result.match(pattern)?.[1];
}

export function ensurePasteBack(step: string): string {
  if (/\bpaste back\b/i.test(step)) return step;
  if (/\b(npm|pnpm|yarn|tsx|vitest|rax|CLI|command)\b/i.test(step)) {
    return `${step}; paste back the output.`;
  }
  return step;
}

function suppliedNpmRunScripts(input: string): Set<string> {
  const scripts = new Set<string>();
  for (const match of input.matchAll(/\bnpm run ([a-z0-9:_-]+)\s+(?:passed|failed)(?:\s+\d+\s*\/\s*\d+)?\b/gi)) {
    if (match[1]) scripts.add(match[1]);
  }
  if (/\bnpm test\s+(passed|failed)\b/i.test(input)) scripts.add("test");
  return scripts;
}

function storedNpmRunScripts(result: OperationExecutionResult): Set<string> {
  const scripts = new Set<string>();
  for (const item of result.evidenceChecked) {
    const match = item.match(/^command-evidence:[^:]+:npm run ([^:]+(?::[^:]+)*):(passed|failed|partial|unknown):/);
    if (match?.[1]) scripts.add(match[1]);
    if (/^command-evidence:[^:]+:npm test:(passed|failed|partial|unknown):/.test(item)) scripts.add("test");
  }
  return scripts;
}

function sectionItems(markdown: string, heading: string): string[] {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`## ${escaped}\\n([\\s\\S]*?)(?=\\n## |\\nRun: |$)`));
  if (!match?.[1]) return [];
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^-\s+/, "").trim())
    .filter((line) => line && line.toLowerCase() !== "none");
}

function gitStatusBlock(markdown: string): string | undefined {
  const match = markdown.match(/## Git Status\n```txt\n([\s\S]*?)\n```/);
  return match?.[1]?.trim();
}

function hasChangedFiles(gitStatus: string): boolean {
  return /\n\s*[MADRCU?]{1,2}\s+/m.test(gitStatus);
}

function branchDrift(gitStatus: string): boolean {
  return /\[(?:ahead|behind|gone|diverged)[^\]]*\]/i.test(gitStatus);
}

function gitStatusRisk(gitStatus?: string): string | undefined {
  if (!gitStatus) return undefined;
  const firstLine = gitStatus.split(/\r?\n/)[0] ?? "";
  if (/\[behind\s+(\d+)\]/i.test(firstLine)) {
    const count = firstLine.match(/\[behind\s+(\d+)\]/i)?.[1];
    return `Biggest verified operating problem: stale branch. The linked repo is behind origin${count ? ` by ${count} commit(s)` : ""}, so local audit results may be outdated until the repo is pulled.`;
  }
  if (/\[(?:ahead|diverged)[^\]]*\]/i.test(firstLine)) {
    return "Biggest verified operating problem: branch drift. The linked repo is not aligned with origin, so proof needs a clean sync boundary before broad claims.";
  }
  if (hasChangedFiles(gitStatus)) {
    return "Biggest verified operating problem: worktree ambiguity. The linked repo has uncommitted changes, so any audit or fix could mix current work with stale assumptions.";
  }
  return undefined;
}

function highestOperatingRisk(risks: string[], missingEvidence: string[]): string | undefined {
  if (risks.includes("git_worktree_has_changes")) {
    return "Biggest verified operating problem: worktree ambiguity. The linked repo has uncommitted changes, so any audit or fix could mix current work with stale assumptions.";
  }
  if (risks.includes("active_handoff_mentions_red_or_failing_test") || risks.includes("active_handoff_has_unvalidated_manual_check")) {
    return "Biggest verified operating problem: handoff/validation drift. The active handoff mentions failing or unvalidated checks, so the next work should first prove the current baseline.";
  }
  if (risks.includes("duplicate_copy_file_names_detected")) {
    return "Biggest verified operating problem: duplicate-file noise. The repo contains copy-style filenames that can make agents edit the wrong surface unless paths are tightly specified.";
  }
  if (risks.includes("no_test_script_detected")) {
    return "Biggest verified operating problem: missing test entrypoint. STAX found no package test script, so proof has to be reconstructed from narrower commands or docs.";
  }
  if (risks.includes("no_test_tree_detected")) {
    return "Biggest verified operating problem: missing test tree. STAX could not verify a test surface from the repo shape.";
  }
  if (risks.includes("git_status_unavailable")) {
    return "Biggest verified operating problem: missing git-status evidence. STAX could inspect files, but it could not verify whether the linked repo is clean.";
  }
  if (missingEvidence.includes("src")) {
    return "Biggest verified operating problem: repo-shape mismatch. The workspace does not expose a conventional src tree, so STAX has to target scripts/tests, e2e, and ops docs instead of using generic repo assumptions.";
  }
  if (missingEvidence.length) {
    return `Biggest verified operating problem: missing expected evidence (${missingEvidence.slice(0, 3).join(", ")}).`;
  }
  return undefined;
}
