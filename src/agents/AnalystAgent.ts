import type { Agent, AgentInput } from "./Agent.js";
import type { AgentResult } from "../schemas/AgentResult.js";

function bulletize(items: string[], fallback: string): string[] {
  return items.length ? items.map((item) => `- ${item}`) : [`- ${fallback}`];
}

function memoryLines(input: AgentInput, type?: string): string[] {
  return (input.memory ?? [])
    .filter((item) => !type || item.type === type)
    .map((item) => `${item.id}: ${item.content}`);
}

function hasTestEvidence(text: string): boolean {
  return /\b(npm run typecheck|npm test|npm run rax -- eval|passed|passRate|exit code 0|tests?:\s*\d+|✓)\b/i.test(text);
}

function detectsPlaceholder(text: string): boolean {
  return /\b(todo|placeholder|stub only|not implemented|empty implementation)\b/i.test(text);
}

function detectsUnsafePolicyDrift(text: string): string[] {
  const checks: Array<[RegExp, string]> = [
    [/shell\s*[:=]\s*["']?allowed|enable(d)? shell/i, "Shell execution enabled or requested."],
    [/fileWrite\s*[:=]\s*["']?allowed|file write.*enabled/i, "File write tools enabled or requested."],
    [/autoSaveModelOutputs\s*[:=]\s*true|auto-save.*model output/i, "Model outputs would auto-save to memory."],
    [/requireCriticPass\s*[:=]\s*false|critic.*disabled/i, "Critic pass disabled or weakened."],
    [/requireSchemaValidation\s*[:=]\s*false|schema validation.*disabled/i, "Schema validation disabled or weakened."],
    [/delete(d)? evidence_policy|weaken(ed)? evidence/i, "Evidence policy deleted or weakened."]
  ];
  return checks.filter(([pattern]) => pattern.test(text)).map(([, issue]) => issue);
}

function hasLocalEvidence(text: string): boolean {
  return text.includes("## Local Evidence");
}

function latestEvalEvidence(text: string): boolean {
  return /### Latest Eval Result[\s\S]*-\s+Path:\s+evals\/eval_results\/.*\.json/i.test(text);
}

function localFilesChanged(text: string): string[] {
  const diffSection = sectionBetween(text, "### Git Diff Name Only", "### Latest Eval Result");
  const diffFiles = diffSection
    .split("\n")
    .map((line) => line.trim().replace(/^-\s+/, ""))
    .filter((line) => line && line !== "None");
  const statusSection = sectionBetween(text, "### Git Status", "### Git Diff Stat");
  const statusFiles = statusSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[MADRCU?]{1,2}\s+/.test(line))
    .map((line) => line.replace(/^[MADRCU?]{1,2}\s+/, "").trim());
  return Array.from(new Set([...diffFiles, ...statusFiles]));
}

function projectStateEvidenceLines(text: string): string[] {
  const lines: string[] = [];
  const latestEval = sectionBetween(text, "### Latest Eval Result", "### Latest Run Folder");
  const latestRun = sectionBetween(text, "### Latest Run Folder", "### Project Docs");
  const maturity = sectionBetween(text, "### Mode Maturity", "### Evidence Collection Errors");
  if (latestEval.includes("Path:")) {
    const evalPath = latestEval.match(/Path:\s+([^\n]+)/)?.[1]?.trim();
    const passRate = latestEval.match(/passRate:\s+([^\n]+)/)?.[1]?.trim();
    lines.push(`Latest eval artifact: ${evalPath ?? "unknown"} with passRate ${passRate ?? "unknown"}.`);
  }
  if (latestRun.includes("- runs/")) {
    lines.push(`Latest run folder: ${latestRun.match(/-\s+(runs\/[^\n]+)/)?.[1]?.trim() ?? "unknown"}.`);
  }
  if (maturity.trim()) {
    const maturityLines = maturity
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^-\s+/.test(line))
      .slice(0, 4);
    lines.push(...maturityLines.map((line) => `Mode maturity: ${line.replace(/^-\s+/, "")}`));
  }
  return lines;
}

function sectionBetween(text: string, startHeading: string, endHeading: string): string {
  const start = text.indexOf(startHeading);
  if (start === -1) return "";
  const afterStart = text.slice(start + startHeading.length);
  const end = afterStart.indexOf(endHeading);
  return (end === -1 ? afterStart : afterStart.slice(0, end)).replace(/```txt|```/g, "").trim();
}

export class AnalystAgent implements Agent {
  name = "analyst";
  mode = "analysis" as const;

  async execute(input: AgentInput): Promise<AgentResult> {
    const providerResponse = await input.provider.complete({
      system: input.system,
      messages: [{ role: "user", content: input.input }],
      temperature: input.config.model.generationTemperature,
      top_p: input.config.model.topP,
      seed: input.config.model.seed,
      maxTokens: input.config.model.maxOutputTokens,
      timeoutMs: input.config.model.timeoutMs
    });

    if (input.mode === "audit") {
      return {
        agent: this.name,
        schema: "audit",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: [
          "## Critic Review",
          "- Pass/Fail: Pass",
          "- Issues Found: Unknown",
          "- Required Fixes: None identified from supplied input",
          "- Confidence: medium"
        ].join("\n")
      };
    }

    if (input.mode === "project_brain") {
      const decisions = memoryLines(input, "decision");
      const knownFailures = memoryLines(input, "known_failure");
      const risks = memoryLines(input, "risk");
      const nextActions = memoryLines(input, "next_action");
      const allMemory = memoryLines(input);
      const localEvidence = projectStateEvidenceLines(input.input);

      return {
        agent: this.name,
        schema: "project_brain",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: [
          "## Project State",
          ...bulletize(
            [
              "STAX/RAX is being treated as a local governed reasoning runtime, not a free-form chatbot.",
              ...localEvidence,
              ...allMemory.map((item) => `Approved memory: ${item}`)
            ],
            "No approved project memory was retrieved."
          ),
          "",
          "## Current Objective",
          "- Advance the repo from Behavior System v0.1 toward project governance modes while preserving STAX fitness behavior.",
          "",
          "## Proven Working",
          "- ev_001: Behavior System v0.1 proof report records typecheck, test, eval, replay, correction, and training-export evidence.",
          "- ev_002: STAX atomic extraction proof covers messy training, sleep, recovery, strain, injury, and nutrition signals.",
          "",
          "## Unproven Claims",
          "- Any newly added governance mode remains unproven until its schema, validator, evals, and CLI smoke output pass.",
          "",
          "## Recent Changes",
          ...bulletize(decisions, "No approved decision memory was retrieved."),
          "",
          "## Known Failures",
          ...bulletize(knownFailures, "No approved known-failure memory was retrieved."),
          "",
          "## Risk Register",
          ...bulletize(
            [
              "Fake-complete risk: docs can claim governance before eval and CLI smoke commands pass.",
              ...risks
            ],
            "No approved risk memory was retrieved."
          ),
          "",
          "## Missing Tests",
          "- Project Brain and Codex Audit now have initial regression evals; replay proof is still needed before behavior-proven status.",
          "- Governance modes still need correction-promotion cases before behavior-proven status.",
          "",
          "## Fake-Complete Risks",
          "- Claims about completed phases are fake-complete unless linked to command output, eval result, trace, or artifact.",
          "",
          "## Next 3 Actions",
          ...(nextActions.length
            ? nextActions.slice(0, 3).map((item, index) => `${index + 1}. ${item}`)
            : [
                "1. Run npm run typecheck and npm test after implementation.",
                "2. Run npm run rax -- eval plus regression/redteam evals.",
                "3. Capture CLI smoke outputs in docs/NEXT_STAGE_REPORT.md."
              ]),
          "",
          "## Codex Prompt",
          "Implement the smallest remaining governance-mode gap. Inspect the mode contract, schema, validator, eval fixture, and CLI command touched by that gap. Run npm run typecheck, npm test, and the relevant npm run rax smoke command before reporting.",
          "",
          "## Evidence Required",
          "- npm run typecheck output",
          "- npm test output",
          "- npm run rax -- eval output",
          "- npm run rax -- run --mode project_brain --file docs/PROJECT_STATE.md output",
          "- Updated docs/NEXT_STAGE_REPORT.md with command results"
        ].join("\n")
      };
    }

    if (input.mode === "codex_audit") {
      const text = input.input.trim();
      const localEvidence = hasLocalEvidence(text);
      const changedFiles = localFilesChanged(text);
      const evalEvidence = latestEvalEvidence(text);
      const testClaim = /\b(all tests pass|tests pass|typecheck passes|evals pass|passed tests)\b/i.test(text);
      const commandEvidence = hasTestEvidence(text) || evalEvidence;
      const placeholder = detectsPlaceholder(text);
      const scopeCreep = /\b(ui|embedding|autonomous shell|recursive agent|free-form agent chat)\b/i.test(text);
      const policyConfigDrift = changedFiles.some((file) =>
        /(^|\/)(rax\.config\.json|policies\/|modes\/.*\.mode\.md|src\/policy\/|src\/safety\/|src\/tools\/)/.test(file)
      );
      const evalChanged = changedFiles.some((file) => file.startsWith("evals/"));
      const docsCompletionClaim = /\b(done|complete|completed|finished)\b/i.test(text) && changedFiles.some((file) => file.startsWith("docs/"));
      const missing = [
        ...(testClaim && !commandEvidence ? ["Test/typecheck/eval command output was not supplied."] : []),
        ...(!localEvidence && !/files? modified|diff|changed files|src\//i.test(text) ? ["Modified files were not identified."] : []),
        ...(localEvidence && !evalEvidence ? ["Latest eval result artifact was not found in local evidence."] : []),
        ...(localEvidence && changedFiles.length > 0 && !commandEvidence ? ["Local changes exist but no test/eval evidence was found."] : []),
        ...(placeholder ? ["Placeholder implementation needs real behavior evidence."] : [])
      ];
      const flags = [
        ...(testClaim && !commandEvidence ? ["Claimed tests pass without output."] : []),
        ...(placeholder ? ["Placeholder-only implementation risk."] : []),
        ...(scopeCreep ? ["Possible scope creep beyond CLI governance work."] : []),
        ...(policyConfigDrift ? ["Policy/config/tool governance files changed; require redteam and regression evidence."] : []),
        ...(evalChanged && !/eval|regression|redteam/i.test(text) ? ["Eval files changed without explanation in the supplied report."] : []),
        ...(docsCompletionClaim && !commandEvidence ? ["Docs claim completion without command evidence."] : [])
      ];
      const recommendation = missing.length || flags.length ? "Reject until evidence is supplied." : "Needs review with supplied evidence.";
      const evidenceFound = [
        ...(commandEvidence ? ["Command output, eval artifact, or pass artifact was supplied."] : []),
        ...(localEvidence ? ["Local git/eval/run evidence was collected read-only."] : []),
        ...(changedFiles.length ? [`Local changed files detected: ${changedFiles.join(", ")}`] : [])
      ];

      return {
        agent: this.name,
        schema: "codex_audit",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: [
          "## Codex Claim",
          `- ${text || "No Codex claim supplied."}`,
          "",
          "## Evidence Found",
          ...bulletize(evidenceFound, "None found."),
          "",
          "## Missing Evidence",
          ...bulletize(missing, "None identified from supplied input."),
          "",
          "## Files Modified",
          changedFiles.length
            ? changedFiles.map((file) => `- ${file}`).join("\n")
            : /\b(src\/|docs\/|tests\/|modes\/|evals\/)/i.test(text)
            ? "- File paths were mentioned in the claim."
            : "- Unknown from supplied input.",
          "",
          "## Tests Added",
          /tests?\//i.test(text) ? "- Test files were mentioned." : "- Unknown from supplied input.",
          "",
          "## Commands Run",
          commandEvidence
            ? "- Command or eval evidence was mentioned in the claim/local evidence."
            : localEvidence
              ? "- Local evidence collection ran read-only git/eval/run inspection; no test command output was supplied."
              : "- None supplied.",
          "",
          "## Violations",
          ...bulletize(
            [
              ...(missing.length ? ["Evidence policy: claims require command output or artifacts."] : []),
              ...(scopeCreep ? ["Scope control: possible unapproved expansion."] : []),
              ...(policyConfigDrift ? ["Tool/policy governance changed; redteam and regression evidence required."] : [])
            ],
            "None identified from supplied input."
          ),
          "",
          "## Fake-Complete Flags",
          ...bulletize(flags, "None identified from supplied input."),
          "",
          "## Required Fix Prompt",
          "Return with exact files modified, tests added, commands run, relevant output snippets, and any remaining failing checks. Do not claim completion without evidence.",
          "",
          "## Approval Recommendation",
          `- ${recommendation}`
        ].join("\n")
      };
    }

    if (input.mode === "code_review") {
      return {
        agent: this.name,
        schema: "code_review",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: [
          "## Findings",
          "- No concrete code context was supplied.",
          "",
          "## Tests",
          "- Unknown",
          "",
          "## Residual Risk",
          "- Missing repository or diff context may hide issues."
        ].join("\n")
      };
    }

    if (input.mode === "teaching") {
      return {
        agent: this.name,
        schema: "teaching",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: [
          "## Explanation",
          input.input,
          "",
          "## Example",
          "- Unknown until more context is supplied.",
          "",
          "## Unknowns",
          "- User's current background knowledge"
        ].join("\n")
      };
    }

    if (input.mode === "general_chat") {
      return {
        agent: this.name,
        schema: "general_chat",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: ["## Response", input.input].join("\n")
      };
    }

    if (input.mode === "test_gap_audit") {
      return {
        agent: this.name,
        schema: "test_gap_audit",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: [
          "## Feature",
          `- ${input.input.trim() || "Unspecified feature."}`,
          "",
          "## Existing Tests",
          "- Unknown until tests and eval fixtures are inspected.",
          "",
          "## Missing Tests",
          "- Positive runtime test for the new behavior.",
          "- Negative test proving the behavior fails when required evidence or schema fields are absent.",
          "",
          "## Negative Cases Needed",
          "- Missing required section.",
          "- Unsupported claim without evidence.",
          "- Unsafe config or policy weakening when applicable.",
          "",
          "## Eval Cases Needed",
          "- Regression eval for expected output shape.",
          "- Redteam or negative-control eval for the failure mode.",
          "",
          "## Priority",
          "- high"
        ].join("\n")
      };
    }

    if (input.mode === "policy_drift") {
      const violations = detectsUnsafePolicyDrift(input.input);
      return {
        agent: this.name,
        schema: "policy_drift",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: [
          "## Policy Change",
          `- ${input.input.trim() || "No policy/config change supplied."}`,
          "",
          "## Drift Checks",
          "- Evidence rules remain required.",
          "- Critic pass remains required.",
          "- Schema validation remains required.",
          "- Shell and file write tools remain disabled by default.",
          "- Raw model outputs do not auto-save to memory.",
          "",
          "## Violations",
          ...bulletize(violations, "None identified from supplied input."),
          "",
          "## Required Evals",
          "- Run npm run rax -- eval --redteam.",
          "- Run npm run rax -- eval --regression.",
          "- Add a drift fixture for any changed policy or unsafe config field.",
          "",
          "## Approval Recommendation",
          violations.length
            ? "- Reject until drift is reversed or covered by explicit human authorization with redteam coverage."
            : "- Needs review with policy diff and eval output."
        ].join("\n")
      };
    }

    return {
      agent: this.name,
      schema: "analysis",
      confidence: "medium",
      metadata: { providerText: providerResponse.text },
      output: [
        "## Facts Used",
        `- ${input.input}`,
        "",
        "## Pattern Candidates",
        "- Unknown",
        "",
        "## Deviations",
        "- Unknown",
        "",
        "## Confidence",
        "- medium",
        "",
        "## Unknowns",
        "- Additional evidence"
      ].join("\n")
    };
  }
}
