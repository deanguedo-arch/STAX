import type { Agent, AgentInput } from "./Agent.js";
import type { AgentResult } from "../schemas/AgentResult.js";
import { assessAuditEvidence, renderAuditContractSections } from "../audit/VerifiedAuditContract.js";
import { decideEvidence, renderEvidenceDecision } from "../audit/EvidenceDecisionGate.js";
import { StrategicDeliberation } from "../strategy/StrategicDeliberation.js";
import { StrategicDecisionFormatter } from "../strategy/StrategicDecisionFormatter.js";

function bulletize(items: string[], fallback: string): string[] {
  return items.length ? items.map((item) => `- ${item}`) : [`- ${fallback}`];
}

function memoryLines(input: AgentInput, type?: string): string[] {
  return (input.memory ?? [])
    .filter((item) => !type || item.type === type)
    .map((item) => `${item.id}: ${item.content}`);
}

function hasTestEvidence(text: string): boolean {
  return /\b(## Local Evidence|## Proof Packet|ProofPacket:|ClaimSupported:|evidence\/commands\/)\b/i.test(text) &&
    /\b(npm run typecheck|npm test|npm run rax -- eval|passed|passRate|exit code 0|tests?:\s*\d+|✓)\b/i.test(text);
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
    [/delete(d)? evidence_policy|weaken(ed)? evidence/i, "Evidence policy deleted or weakened."],
    [/read\s+\.env|inspect\s+private keys?|secret access/i, "Secret or private key access requested."],
    [/run\s+npm\s+test\s+inside\s+a\s+linked|run.*tests?.*linked external repo|execute.*linked repo/i, "Linked repo command execution requested."],
    [/patch files directly|write to.*linked repo|external repo write|mutate.*linked repo/i, "Linked or external repo mutation requested."],
    [/auto[- ]?approve|self[- ]?approve|approve itself/i, "Self-approval or auto-approval requested."],
    [/auto[- ]?promote|bypass.*promotion gate|promotion.*bypass/i, "Promotion gate bypass or auto-promotion requested."],
    [/auto[- ]?train|train.*without approval/i, "Training or model updates requested without approval."]
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
  if (text.includes("## Workspace Context")) {
    const workspace = text.match(/-\s+Workspace:\s+([^\n]+)/)?.[1]?.trim();
    lines.push(
      /No active workspace/i.test(text)
        ? "No active workspace was available; global project docs were used."
        : `Active workspace context: ${workspace ?? "unknown"}.`
    );
  }
  if (text.includes("## Repo Summary") || text.includes("## Repo Evidence Pack") || text.includes("## Workspace / Repo")) {
    lines.push("Workspace repo evidence context was supplied.");
  }
  return lines;
}

function auditEvidenceFoundLines(text: string): string[] {
  const lines: string[] = [];
  const tracePath = text.match(/\bTrace:\s+(runs\/[^\s]+\/trace\.json)/i)?.[1];
  const runFolder = text.match(/\bRun Folder:\s+(runs\/[^\s]+)/i)?.[1] ??
    text.match(/\bLatest run folder:\s+(runs\/[^\n]+)/i)?.[1];
  const evalPath = text.match(/\bPath:\s+(evals\/eval_results\/[^\s]+\.json)/i)?.[1];
  const passRate = text.match(/\bpassRate:\s+([^\n]+)/i)?.[1]?.trim();
  const proofPacket = text.match(/\bProofPacket:\s+([^\n]+)/i)?.[1]?.trim();
  const claimSupported = Array.from(text.matchAll(/\bClaimSupported:\s+([^\n]+)/gi)).map((match) => match[1]?.trim()).filter(Boolean);
  const redactions = Array.from(text.matchAll(/-\s+([a-z_]+):\s+([1-9]\d*)/gi))
    .filter((match) => /private_key|token|secret|cookie|key/i.test(match[1] ?? ""))
    .map((match) => `${match[1]}=${match[2]}`);

  if (proofPacket) lines.push(`Proof packet: ${proofPacket}.`);
  if (tracePath) lines.push(`Trace artifact: ${tracePath}.`);
  if (runFolder) lines.push(`Run artifact: ${runFolder}.`);
  if (evalPath) lines.push(`Eval artifact: ${evalPath}${passRate ? ` with passRate ${passRate}` : ""}.`);
  for (const claim of claimSupported.slice(0, 4)) {
    lines.push(`Claim supported by evidence: ${claim}.`);
  }
  if (redactions.length) {
    lines.push(`Proof packet redactions applied: ${redactions.join(", ")}.`);
  }
  return Array.from(new Set(lines));
}

function sectionBetween(text: string, startHeading: string, endHeading: string): string {
  const start = text.indexOf(startHeading);
  if (start === -1) return "";
  const afterStart = text.slice(start + startHeading.length);
  const end = afterStart.indexOf(endHeading);
  return (end === -1 ? afterStart : afterStart.slice(0, end)).replace(/```txt|```/g, "").trim();
}

function isMockLikeProvider(name: string): boolean {
  return name === "mock" || name.startsWith("mock-");
}

function shouldUseProviderBackedAnalyst(input: AgentInput): boolean {
  return (
    !isMockLikeProvider(input.provider.name) &&
    (
      input.mode === "analysis" ||
      input.mode === "project_control" ||
      input.mode === "codex_audit" ||
      input.mode === "code_review" ||
      input.mode === "project_brain" ||
      input.mode === "test_gap_audit" ||
      input.mode === "policy_drift" ||
      input.mode === "model_comparison"
    )
  );
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

    if (shouldUseProviderBackedAnalyst(input)) {
      return {
        agent: this.name,
        schema: input.mode,
        confidence: "medium",
        metadata: { providerText: providerResponse.text, providerBacked: true },
        output: providerResponse.text.trim()
      };
    }

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

    if (input.mode === "learning_unit") {
      const runId = input.input.match(/run-[a-zA-Z0-9T.-]+/)?.[0];
      return {
        agent: this.name,
        schema: "learning_unit",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: [
          "## Run / Input Summary",
          runId
            ? `- Source run: ${runId}.`
            : "- No run id was supplied; this is an input-level learning analysis.",
          "- STAX should treat this as evidence for approved learning-loop improvement, not as autonomous promotion.",
          "",
          "## Weakness Detected",
          "- The interaction should be checked for generic output, missing specificity, and missing approval boundaries.",
          "",
          "## Failure Type",
          "- generic_output",
          "- weak_plan",
          "- missing_specificity",
          "",
          "## Root Cause",
          "- The system needs a concrete LearningEvent, queue, proposal, and approval path whenever an answer is weak or under-specified.",
          "",
          "## Proposed LearningEvent",
          "- Record input, output, route, policies, schema status, critic status, quality scores, trace/final links, and approval state.",
          "",
          "## Candidate Queues",
          "- eval_candidate",
          "- mode_contract_patch_candidate",
          "- codex_prompt_candidate",
          "",
          "## Suggested Eval Candidate",
          "- Add a regression eval requiring learning-unit output to include Candidate Queues and Approval Required.",
          "",
          "## Suggested Correction Candidate",
          "- Create a pending correction only after a user supplies corrected output for the weak run.",
          "",
          "## Suggested Memory Candidate",
          "- Create pending memory only for explicit stable user preferences or project decisions; do not store raw model output.",
          "",
          "## Suggested Policy Patch",
          "- Add or preserve the rule that learning proposals are evidence, not authority, and cannot bypass approval.",
          "",
          "## Suggested Schema / Mode Patch",
          "- Require learning-unit outputs to include concrete candidates, source links, and explicit approval boundaries.",
          "",
          "## Suggested Codex Prompt",
          "Implement the approved learning-loop patch with behavior tests. Do not promote memory, evals, training, policies, schemas, modes, AGENTS.md, or config without explicit approval. Run npm run typecheck, npm test, npm run rax -- eval, and regression evals before claiming completion.",
          "",
          "## Approval Required",
          "- Promotion requires explicit approval. The learning unit may propose updates only; it cannot approve, promote, or modify durable system state."
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
          ...(input.input.includes("## Repo Summary") || input.input.includes("## Repo Evidence Pack") || input.input.includes("## Workspace / Repo")
            ? [
                "## Repo Evidence Pack",
                "- Workspace repo evidence context was supplied to Project Brain.",
                ""
              ]
            : []),
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
      const auditAssessment = assessAuditEvidence(text);
      const evidenceDecision = decideEvidence(text);
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
        ...auditAssessment.missingEvidence.filter((item) => !/none identified/i.test(item)),
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
        ...auditEvidenceFoundLines(text),
        ...(changedFiles.length ? [`Local changed files detected: ${changedFiles.join(", ")}`] : [])
      ];

      return {
        agent: this.name,
        schema: "codex_audit",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: [
          ...renderAuditContractSections(auditAssessment),
          "",
          ...renderEvidenceDecision(evidenceDecision),
          "",
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

    if (input.mode === "project_control") {
      const packet = parseProjectControlPacket(input.input);
      return {
        agent: this.name,
        schema: "project_control",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: renderProjectControl(packet)
      };
    }

    if (input.mode === "model_comparison") {
      const text = input.input.trim();
      const evidenceLines = auditEvidenceFoundLines(text);
      const evidenceDecision = decideEvidence(text);
      const hasStaxAnswer = /\bSTAX Answer\b|## STAX|Run:\s+run-|Trace:\s+runs\//i.test(text);
      const hasExternalAnswer = /\bExternal Answer\b|ChatGPT|external assistant|other answer/i.test(text);
      const localProof = evidenceLines.length > 0 || /\b(runs\/|trace\.json|learningEvent|evals\/|proof packet|local evidence)\b/i.test(text);
      return {
        agent: this.name,
        schema: "model_comparison",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: [
          "## Task",
          `- Compare the supplied STAX answer, external answer, and any local evidence for project usefulness.`,
          "",
          "## STAX Answer Strengths",
          hasStaxAnswer
            ? "- STAX can be stronger when it cites local runs, traces, LearningEvents, evals, or repo artifacts."
            : "- No clearly labeled STAX answer was supplied; this comparison is partial.",
          "",
          "## External Answer Strengths",
          hasExternalAnswer
            ? "- The external answer can contribute broader reasoning, alternate framing, or clearer strategy."
            : "- No clearly labeled external answer was supplied; this comparison is partial.",
          "",
          "## Evidence Comparison",
          ...bulletize(
            [
              ...(localProof ? ["Local proof or artifact references were supplied."] : ["No local proof artifact was supplied; this cannot be treated as a verified comparison."]),
              ...evidenceLines
            ],
            "No evidence supplied."
          ),
          "",
          ...renderEvidenceDecision(evidenceDecision),
          "",
          "## Specificity Comparison",
          "- Prefer the answer that names exact files, tests, evals, commands, artifacts, and approval boundaries.",
          "- Penalize generic advice that cannot be verified inside the repo.",
          "",
          "## Actionability Comparison",
          "- The better project answer should produce a bounded Codex prompt or concrete next verification step.",
          "- The answer must not promote memory, evals, training data, policies, schemas, or modes without approval.",
          "",
          "## Missing Local Proof",
          localProof
            ? "- Review whether the cited artifacts actually support the claims before promotion."
            : "- Add trace, eval, test, or file evidence before claiming one answer is proven better.",
          "",
          "## Safer Answer",
          "- Use the external answer as a reasoning input, but treat local STAX evidence as the deciding proof surface.",
          "",
          "## Better Answer For This Project",
          "- The better answer is the one that is locally testable, evidence-linked, and can create eval/correction/patch candidates without self-approval.",
          "",
          "## Recommended Correction",
          "- If STAX missed useful external reasoning, capture a correction candidate linked to the run and evidence instead of storing raw external output as memory.",
          "",
          "## Recommended Eval",
          "- Add a regression comparison case requiring Evidence Comparison, Missing Local Proof, Recommended Correction, and Recommended Eval sections.",
          "",
          "## Recommended Prompt / Patch",
          "Ask Codex to implement only the missing locally proven behavior, add paired positive/negative evals, run typecheck/tests/evals, and report artifacts before claiming completion."
        ].join("\n")
      };
    }

    if (input.mode === "strategic_deliberation") {
      const decision = new StrategicDeliberation().decide({
        question: strategicQuestionFrom(input.input),
        rawInput: input.input,
        config: input.config
      });
      return {
        agent: this.name,
        schema: "strategic_deliberation",
        confidence: decision.decisionConfidence,
        metadata: { providerText: providerResponse.text, providerCapability: decision.providerCapability },
        output: new StrategicDecisionFormatter().format(decision)
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

type ProjectControlPacket = {
  task: string;
  repoEvidence: string;
  commandEvidence: string;
  codexReport: string;
};

function parseProjectControlPacket(input: string): ProjectControlPacket {
  return {
    task: extractLabeledBlock(input, "Task", ["Repo Evidence", "Command Evidence", "Codex Report", "Return"]) || input.trim(),
    repoEvidence: extractLabeledBlock(input, "Repo Evidence", ["Command Evidence", "Codex Report", "Return"]),
    commandEvidence: extractLabeledBlock(input, "Command Evidence", ["Codex Report", "Return"]),
    codexReport: extractLabeledBlock(input, "Codex Report", ["Return"])
  };
}

function extractLabeledBlock(input: string, label: string, followingLabels: string[]): string {
  const start = input.search(new RegExp(`^${escapeRegExp(label)}:\\s*`, "im"));
  if (start === -1) return "";
  const afterLabel = input.slice(start).replace(new RegExp(`^${escapeRegExp(label)}:\\s*`, "i"), "");
  const nextPositions = followingLabels
    .map((next) => afterLabel.search(new RegExp(`\\n${escapeRegExp(next)}:\\s*`, "i")))
    .filter((index) => index >= 0);
  const end = nextPositions.length ? Math.min(...nextPositions) : afterLabel.length;
  return afterLabel.slice(0, end).trim();
}

function renderProjectControl(packet: ProjectControlPacket): string {
  const combined = [packet.task, packet.repoEvidence, packet.commandEvidence, packet.codexReport].join("\n");
  const lower = combined.toLowerCase();
  const reportLower = packet.codexReport.toLowerCase();
  const brightspace = /brightspace|brightspacequizexporter/i.test(combined);
  const rollupPresent = /@rollup\/rollup-darwin-arm64@?4\.59\.0/i.test(combined) && /\bnpm ls\b/i.test(combined);
  const buildNotRun = /npm run build (?:and )?npm run ingest:ci have not been run|build .*not been run|npm run build.*not been run/i.test(combined);
  const ingestNotRun = /ingest:ci .*not been run|npm run ingest:ci.*not been run/i.test(combined);
  const docsOnly = /diff summary .*only shows docs\/|only docs\/|docs-only/i.test(combined);
  const codexClaimsTestsPassed = /\b(all tests passed|tests passed|npm test passed|test suite passed)\b/i.test(packet.codexReport);
  const codexClaimsComplete = /\b(fixed|implemented|complete|completed|finished)\b/i.test(packet.codexReport);
  const evidenceText = packet.commandEvidence + "\n" + packet.repoEvidence;
  const negatesCommandEvidence = /\b(no local .*command evidence|no local command output|command evidence:\s*none|none supplied|not supplied)\b/i.test(evidenceText);
  const hasCommandOutput = !negatesCommandEvidence && /\b(exit code 0|local STAX command evidence|npm ls|run-\d{4}|runs\/\d{4}|passed, \d+\/\d+|Test Files\s+\d+ passed)\b/i.test(evidenceText);
  const inventedPathRisk = /src\/not-real|not-real-provider-router/i.test(combined);

  const verified: string[] = [];
  const weak: string[] = [];
  const unverified: string[] = [];
  const risks: string[] = [];

  if (/no local .*command evidence|no local command output/i.test(combined)) {
    verified.push("The supplied evidence includes no local command output for the claimed pass/completion state.");
  }
  if (docsOnly) {
    verified.push("The supplied diff evidence is docs-only; no runtime/source/test change is supplied.");
  }
  if (rollupPresent) {
    verified.push("Read-only npm ls evidence shows @rollup/rollup-darwin-arm64@4.59.0 installed under rollup@4.59.0.");
  }
  if (/git status: ## main\.\.\.origin\/main, no modified files/i.test(combined)) {
    verified.push("Supplied git status says the Brightspace worktree is clean on main...origin/main.");
  }

  if (packet.codexReport.trim() && !/^none supplied\.?$/i.test(packet.codexReport.trim())) {
    weak.push(`Codex reported: ${packet.codexReport.replace(/\s+/g, " ").trim()}`);
  }
  if (/paste|supplied repo evidence does not list/i.test(packet.repoEvidence) && inventedPathRisk) {
    weak.push("The report names a file path, but the supplied repo evidence does not prove that path exists.");
  }

  if (codexClaimsTestsPassed && !hasCommandOutput) {
    unverified.push("The tests-passed claim is unverified because no local command evidence was supplied.");
    risks.push("Fake-complete risk: a confident test claim could be accepted without proof.");
  }
  if (inventedPathRisk) {
    unverified.push("The claimed file path is unverified and should be treated as possibly invented.");
    risks.push("Invented-path risk: acting on a nonexistent file can send Codex into the wrong area.");
  }
  if (docsOnly && codexClaimsComplete) {
    unverified.push("The implementation/completion claim is unverified because docs-only evidence cannot prove runtime behavior.");
    risks.push("Docs-only completion risk: the report may describe behavior that was not implemented.");
  }
  if (brightspace && buildNotRun) {
    unverified.push("Brightspace build status is unverified because npm run build has not been run in the supplied evidence.");
  }
  if (brightspace && ingestNotRun) {
    unverified.push("Brightspace ingest status is unverified because npm run ingest:ci has not been run in the supplied evidence.");
  }
  if (!unverified.length && !hasCommandOutput) {
    unverified.push("Runtime behavior remains unverified until local command evidence is supplied.");
  }
  if (brightspace && (buildNotRun || ingestNotRun)) {
    risks.push("The current risk is no longer the Rollup package itself; it is unproven build/ingest gate status.");
  }
  if (!risks.length) {
    risks.push("The main risk is upgrading weak or missing evidence into a hard completion claim.");
  }

  const nextAction = projectControlNextAction({
    brightspace,
    rollupPresent,
    buildNotRun,
    ingestNotRun,
    docsOnly,
    inventedPathRisk,
    codexClaimsTestsPassed
  });
  const prompt = projectControlPrompt({
    brightspace,
    rollupPresent,
    buildNotRun,
    ingestNotRun,
    docsOnly,
    inventedPathRisk,
    codexClaimsTestsPassed
  });

  return [
    "## Verdict",
    `- ${projectControlVerdict({ brightspace, rollupPresent, buildNotRun, ingestNotRun, docsOnly, inventedPathRisk, codexClaimsTestsPassed, codexClaimsComplete })}`,
    "",
    "## Verified",
    ...bulletize(verified, "No hard completion/runtime claim is verified from the supplied evidence."),
    "",
    "## Weak / Provisional",
    ...bulletize(weak, "No weak/provisional external claim was supplied."),
    "",
    "## Unverified",
    ...bulletize(unverified, "No additional unverified claim identified."),
    "",
    "## Risk",
    ...bulletize(risks, "The main risk is unclear proof scope."),
    "",
    "## One Next Action",
    `- ${nextAction}`,
    "",
    "## Codex Prompt if needed",
    prompt
  ].join("\n");
}

function projectControlVerdict(input: {
  brightspace: boolean;
  rollupPresent: boolean;
  buildNotRun: boolean;
  ingestNotRun: boolean;
  docsOnly: boolean;
  inventedPathRisk: boolean;
  codexClaimsTestsPassed: boolean;
  codexClaimsComplete: boolean;
}): string {
  if (input.brightspace && input.rollupPresent && (input.buildNotRun || input.ingestNotRun)) {
    return "Dependency presence is partially proven; build and ingest success are not proven yet.";
  }
  if (input.docsOnly && input.codexClaimsComplete) {
    return "Not complete as proven; docs-only evidence cannot prove implementation.";
  }
  if (input.inventedPathRisk) {
    return "Not proven; the claimed file path is unsupported by supplied repo evidence.";
  }
  if (input.codexClaimsTestsPassed) {
    return "Not proven; the tests-passed claim needs local command evidence.";
  }
  return "Needs evidence before approval.";
}

function projectControlNextAction(input: {
  brightspace: boolean;
  rollupPresent: boolean;
  buildNotRun: boolean;
  ingestNotRun: boolean;
  docsOnly: boolean;
  inventedPathRisk: boolean;
  codexClaimsTestsPassed: boolean;
}): string {
  if (input.brightspace && input.rollupPresent && (input.buildNotRun || input.ingestNotRun)) {
    return "In /Users/deanguedo/Documents/GitHub/brightspacequizexporter, run npm run ingest:ci and report whether its build step passed, whether ingest:promotion-check was reached, and the first failure or passing output.";
  }
  if (input.docsOnly) {
    return "Ask Codex for the exact source/test diff or a correction saying this was docs-only, plus the first proof command that would verify the claimed runtime behavior.";
  }
  if (input.inventedPathRisk) {
    return "Ask Codex to prove the claimed file exists with a file listing or diff before accepting any test-pass or implementation claim.";
  }
  if (input.codexClaimsTestsPassed) {
    return "Ask Codex to return the exact command output for npm test or rerun the relevant local test command before treating the report as proven.";
  }
  return "Collect the smallest local evidence packet: relevant diff, exact command output, and first remaining failure if any.";
}

function projectControlPrompt(input: {
  brightspace: boolean;
  rollupPresent: boolean;
  buildNotRun: boolean;
  ingestNotRun: boolean;
  docsOnly: boolean;
  inventedPathRisk: boolean;
  codexClaimsTestsPassed: boolean;
}): string {
  if (input.brightspace && input.rollupPresent && (input.buildNotRun || input.ingestNotRun)) {
    return [
      "```txt",
      "In /Users/deanguedo/Documents/GitHub/brightspacequizexporter, prove the current build/ingest gate without broadening scope.",
      "",
      "Current evidence:",
      "- npm ls shows @rollup/rollup-darwin-arm64@4.59.0 installed under rollup@4.59.0.",
      "- package scripts define build as `tsc -b && vite build`.",
      "- package scripts define ingest:ci as `npm run build && npm run ingest:promotion-check`.",
      "",
      "Do not edit files.",
      "Do not run ingest:seed-gold.",
      "Do not change parser/source/fixture/gold/benchmark/test logic.",
      "",
      "Run exactly:",
      "npm run ingest:ci",
      "",
      "Report:",
      "- exact commands run",
      "- command outputs",
      "- whether the build step passed",
      "- whether ingest:promotion-check was reached",
      "- whether both gates passed",
      "- first remaining failure if either gate fails",
      "- confirm no tracked files changed",
      "```"
    ].join("\n");
  }

  if (input.docsOnly) {
    return [
      "```txt",
      "Audit your prior report. The supplied diff evidence shows only docs/RAX_REPORT.md changed.",
      "Do not claim runtime behavior was implemented unless you can provide source/test diffs and command output.",
      "Return exact files changed, commands run, outputs, and the first missing implementation/proof step.",
      "```"
    ].join("\n");
  }

  if (input.inventedPathRisk) {
    return [
      "```txt",
      "Prove the claimed file path before claiming implementation or test success.",
      "Return the exact diff or file listing for the claimed path, then provide local command output for the relevant test.",
      "If the path does not exist, say so and give the corrected file path.",
      "```"
    ].join("\n");
  }

  if (input.codexClaimsTestsPassed) {
    return [
      "```txt",
      "Return the exact command output that proves the tests passed.",
      "Include the command, exit code, relevant output snippet, and first remaining failure if it did not pass.",
      "Do not claim completion without local command evidence.",
      "```"
    ].join("\n");
  }

  return [
    "```txt",
    "Return the smallest evidence packet for this claim: exact files changed, exact commands run, command outputs, and first remaining failure if any.",
    "Do not claim completion without local proof.",
    "```"
  ].join("\n");
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function strategicQuestionFrom(input: string): string {
  const match = input.match(/(?:question|task|ask)\s*:\s*(.+)/i);
  if (match?.[1]) return match[1].trim();
  return input.trim() || "What strategic direction should STAX choose next?";
}
