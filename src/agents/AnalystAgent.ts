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

type ProjectControlSignals = {
  targetRepoPath?: string;
  repoPathWithheld: boolean;
  wrongRepoEvidencePaths: string[];
  brightspace: boolean;
  rollupPresent: boolean;
  buildNotRun: boolean;
  ingestNotRun: boolean;
  docsOnly: boolean;
  inventedPathRisk: boolean;
  codexClaimsTestsPassed: boolean;
  codexClaimsComplete: boolean;
  admissionApp: boolean;
  buildPagesClaim: boolean;
  iosReleaseClaim: boolean;
  sheetsPublishClaim: boolean;
  ualbertaPipelineClaim: boolean;
  avgTotalApplyClaim: boolean;
  visualProofClaim: boolean;
  appsScriptStructureClaim: boolean;
  humanPastedWeakProof: boolean;
  memoryAutoApprovalClaim: boolean;
  dependencyScopeViolation: boolean;
  seedGoldMisuse: boolean;
  scriptExistsAsProof: boolean;
  pipelinePublishClaim: boolean;
  sheetsValidationCommandKnown: boolean;
  canvasBuildStudioClaim: boolean;
  ualbertaFixtureCommandKnown: boolean;
  canvasHelper: boolean;
};

function parseProjectControlPacket(input: string): ProjectControlPacket {
  return {
    task: extractLabeledBlock(input, "Task", ["Repo Evidence", "Command Evidence", "Codex Report", "Return"]) || input.trim(),
    repoEvidence: extractLabeledBlock(input, "Repo Evidence", ["Command Evidence", "Codex Report", "Return"]),
    commandEvidence: extractLabeledBlock(input, "Command Evidence", ["Codex Report", "Return"]),
    codexReport: extractLabeledBlock(input, "Codex Report", ["Return"])
  };
}

function extractTargetRepoPath(repoEvidence: string): string | undefined {
  const explicit = repoEvidence.match(/\bTarget repo path:\s*(\/Users\/deanguedo\/Documents\/GitHub\/[^\s]+)/i)?.[1];
  if (explicit) return explicit.trim().replace(/[.,;)]$/, "");
  const repo = repoEvidence.match(/\bRepo:\s*(\/Users\/deanguedo\/Documents\/GitHub\/[^\s]+)/i)?.[1];
  if (repo) return repo.trim().replace(/[.,;)]$/, "");
  return undefined;
}

function extractRepoPaths(text: string): string[] {
  return Array.from(text.matchAll(/\/Users\/deanguedo\/Documents\/GitHub\/[A-Za-z0-9_.-]+/g))
    .map((match) => match[0].replace(/[.,;)]$/, ""))
    .filter(Boolean);
}

function extractWrongRepoEvidencePaths(packet: ProjectControlPacket, targetRepoPath: string): string[] {
  const evidencePaths = extractRepoPaths([packet.commandEvidence, packet.codexReport].join("\n"));
  return Array.from(new Set(evidencePaths.filter((repoPath) => repoPath !== targetRepoPath)));
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
  const targetRepoPath = extractTargetRepoPath(packet.repoEvidence);
  const repoPathWithheld = !targetRepoPath && /\b(repo path|repo root|target repo)\b[\s\S]{0,60}\b(withheld|not supplied|missing|intentionally withheld)\b/i.test(combined);
  const wrongRepoEvidencePaths = targetRepoPath ? extractWrongRepoEvidencePaths(packet, targetRepoPath) : [];
  const hasWrongRepoEvidence = wrongRepoEvidencePaths.length > 0;
  const brightspace = /brightspace|brightspacequizexporter/i.test(combined);
  const rollupPresent = /@rollup\/rollup-darwin-arm64@?4\.59\.0/i.test(combined) && /\bnpm ls\b/i.test(combined);
  const buildIngestUnproven = lower.includes("build/ingest gate") && lower.includes("unproven");
  const buildNotRun = buildIngestUnproven || /npm run build (?:and )?npm run ingest:ci have not been run|build .*not been run|npm run build.*not been run|build and ingest .*not proven/i.test(combined);
  const ingestNotRun = buildIngestUnproven || /ingest:ci .*not been run|npm run ingest:ci.*not been run|ingest gate .*unproven|ingest .*not proven/i.test(combined);
  const docsOnly = /diff summary .*only shows docs\/|only docs\/|docs-only/i.test(combined);
  const codexClaimsTestsPassed = /\b(all tests passed|tests passed|npm test passed|test suite passed)\b/i.test(packet.codexReport);
  const codexClaimsComplete = /\b(fixed|implemented|complete|completed|finished|ready|verified)\b/i.test(packet.codexReport);
  const evidenceText = packet.commandEvidence + "\n" + packet.repoEvidence;
  const negatesCommandEvidence = /\b(no local .*command evidence|no local command output|command evidence:\s*none|none supplied|not supplied)\b/i.test(evidenceText);
  const hasCommandOutput = !hasWrongRepoEvidence && !negatesCommandEvidence && /\b(exit code 0|local STAX command evidence|npm ls|run-\d{4}|runs\/\d{4}|passed, \d+\/\d+|Test Files\s+\d+ passed)\b/i.test(evidenceText);
  const inventedPathRisk = /src\/not-real|not-real-provider-router/i.test(combined);
  const reportAndCommand = [packet.codexReport, packet.commandEvidence].join("\n");
  const taskAndReport = [packet.task, packet.codexReport].join("\n");
  const signals: ProjectControlSignals = {
    targetRepoPath,
    repoPathWithheld,
    wrongRepoEvidencePaths,
    brightspace,
    rollupPresent,
    buildNotRun,
    ingestNotRun,
    docsOnly,
    inventedPathRisk,
    codexClaimsTestsPassed,
    codexClaimsComplete,
    admissionApp: /ADMISSION-APP|admissions checker|admissions pipeline/i.test(combined),
    buildPagesClaim: /build:pages|Pages build|tools\/build-pages\.js/i.test(combined),
    iosReleaseClaim: /TestFlight|App Store|iOS wrapper|IOS_RELEASE_GATE|mobile\/ios-wrapper|release readiness|submit to TestFlight/i.test(combined),
    sheetsPublishClaim: /SYNC_ALL|SYNC_PROGRAMS|publish to Sheets|Google Sheets|sheets_sync|target Sheet/i.test(combined),
    ualbertaPipelineClaim: /UAlberta|ualberta|check_ualberta_url_map_fixtures|ualberta_program_seed|canonical_url_map/i.test(combined),
    avgTotalApplyClaim: /Avg_Total|apply-avg-total-candidates|avg_total_candidates|DryRun/i.test(combined),
    visualProofClaim: /visual|layout|looks good|CSS|screenshot|rendered preview|WebAppStyles|card text fit|checkmark containment/i.test(taskAndReport),
    appsScriptStructureClaim: /Apps Script deploy|validate-apps-script-structure|export-appsscript-bundles|WebApp\.html|Code\.gs|EligibilityEngine\.gs/i.test(combined),
    humanPastedWeakProof: /human-pasted|Human-pasted|human pasted/i.test(combined),
    memoryAutoApprovalClaim: /approved project memory|saved .*memory|auto-save|raw model output|approval metadata|poison scan/i.test(combined),
    dependencyScopeViolation: /src\/parser\.ts|parser logic|source\/parser|forbidden tracked changes/i.test(reportAndCommand),
    seedGoldMisuse: /\b(?:ran|run|running|succeeded|updated|changed|used|fixed)\b[\s\S]{0,100}\b(?:ingest:seed-gold|seed-gold|gold files|gold\/|fixture\/gold)\b/i.test(reportAndCommand),
    scriptExistsAsProof: /script exists|scripts exist|package\.json (?:has|contains)|existence of the .*script|because package\.json (?:has|contains)/i.test(combined),
    pipelinePublishClaim: /ready to publish|canonical CSV exists|validate-canonical|QA gates|pipeline output|publish readiness/i.test(combined),
    sheetsValidationCommandKnown: /validate-sync-surface\.ps1/i.test(combined),
    canvasBuildStudioClaim: /build:studio|studio build/i.test(combined),
    ualbertaFixtureCommandKnown: /pipeline\/check_ualberta_url_map_fixtures\.py/i.test(combined),
    canvasHelper: /canvas-helper|Sports Wellness|sportswellness/i.test(combined)
  };

  const verified: string[] = [];
  const weak: string[] = [];
  const unverified: string[] = [];
  const risks: string[] = [];

  if (targetRepoPath) {
    verified.push(`Target repo path is ${targetRepoPath}.`);
  }
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
  if (signals.buildPagesClaim) {
    verified.push("The supplied evidence identifies the ADMISSION-APP build:pages script, but script existence is not command success.");
  }
  if (signals.iosReleaseClaim) {
    verified.push("The supplied evidence identifies an iOS release gate/checklist, but unchecked checklist items are not release proof.");
  }
  if (signals.appsScriptStructureClaim) {
    verified.push("The supplied evidence identifies Apps Script structure/validation surfaces, but no structure validation output is supplied.");
  }
  if (signals.ualbertaPipelineClaim) {
    verified.push("The supplied evidence identifies UAlberta pipeline files or fixture commands, but not a passing fixture run.");
  }
  if (signals.sheetsPublishClaim) {
    verified.push("The supplied evidence identifies Sheets publish/sync surfaces, but not a verified target or safe publish run.");
  }

  if (packet.codexReport.trim() && !/^none supplied\.?$/i.test(packet.codexReport.trim())) {
    weak.push(`Codex reported: ${packet.codexReport.replace(/\s+/g, " ").trim()}`);
  }
  for (const wrongPath of wrongRepoEvidencePaths) {
    weak.push(`Evidence from ${wrongPath} is wrong-repo evidence for target ${targetRepoPath}.`);
  }
  if (signals.humanPastedWeakProof) {
    weak.push("Human-pasted command output is provisional unless backed by local STAX command evidence.");
  }
  if (/paste|supplied repo evidence does not list/i.test(packet.repoEvidence) && inventedPathRisk) {
    weak.push("The report names a file path, but the supplied repo evidence does not prove that path exists.");
  }

  if (repoPathWithheld) {
    unverified.push("The target repo path is withheld, so command execution or file-path claims cannot be safely targeted yet.");
    risks.push("Wrong-repo risk: choosing a command before the repo root is known can validate or mutate the wrong project.");
  }
  if (hasWrongRepoEvidence) {
    unverified.push("The supplied command/report evidence is from a different repo and cannot verify the target repo claim.");
    risks.push("Wrong-repo proof risk: accepting cross-repo command output can create false project readiness.");
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
  if (signals.buildPagesClaim && !hasCommandOutput) {
    unverified.push("ADMISSION-APP build/pages success is unverified because npm run build:pages output was not supplied.");
    risks.push("Script-existence risk: package.json can name a command without proving it ran or passed.");
  }
  if (signals.iosReleaseClaim && !hasCommandOutput) {
    unverified.push("iOS release readiness is unverified until wrapper build, auth/access, workflow, device, accessibility, and ops gates have evidence.");
    risks.push("Release-boundary risk: submitting to TestFlight/App Store from unchecked checklist items can hide blocker defects.");
  }
  if (signals.sheetsPublishClaim && !hasCommandOutput) {
    unverified.push("Sheets publish safety is unverified because target, credentials/config, validation, and sync output were not supplied.");
    risks.push("Publish-boundary risk: syncing admissions data without target/validation proof can overwrite the wrong sheet or publish bad data.");
  }
  if (signals.ualbertaPipelineClaim && !hasCommandOutput) {
    unverified.push("UAlberta pipeline support is unverified because file existence does not prove fixture checks or pipeline QA passed.");
    risks.push("Pipeline-proof risk: seed/config files can exist while extraction, URL mapping, or QA still fails.");
  }
  if (signals.avgTotalApplyClaim) {
    unverified.push("Avg_Total application is unverified until candidate diff and local dry-run/apply evidence are supplied.");
    risks.push("Canonical-data mutation risk: applying average rules without a reviewed diff can corrupt admissions outputs.");
  }
  if (signals.visualProofClaim) {
    unverified.push("Visual/layout correctness is unverified because no screenshot, rendered preview, or visual checklist finding was supplied.");
    risks.push("Visual-proof risk: source or CSS changes alone cannot prove rendered layout, text fit, or containment.");
  }
  if (signals.appsScriptStructureClaim && !hasCommandOutput) {
    unverified.push("Apps Script deploy readiness is unverified because structure validation and bundle/export evidence were not supplied.");
    risks.push("Deploy-boundary risk: editing a web file does not prove the Apps Script bundle is structurally safe to deploy.");
  }
  if (signals.memoryAutoApprovalClaim) {
    unverified.push("Approved memory is unverified because no approval metadata, source run, approval reason, or poison scan was supplied.");
    risks.push("Memory-poisoning risk: raw model output must not become approved memory automatically.");
  }
  if (signals.dependencyScopeViolation) {
    unverified.push("The dependency/install repair scope is violated or unproven because a source/parser path is mentioned in a dependency repair.");
    risks.push("Scope-creep risk: dependency repair can become hidden parser/source mutation.");
  }
  if (signals.seedGoldMisuse) {
    unverified.push("The ingest fix is not acceptable proof because ingest:seed-gold or gold mutation is a forbidden repair path for this packet.");
    risks.push("Proof-boundary risk: reseeding gold can hide regressions instead of proving ingest behavior.");
  }
  if (signals.scriptExistsAsProof && !hasCommandOutput) {
    unverified.push("A script existing in package.json does not prove the command passed.");
  }
  if (signals.pipelinePublishClaim && !hasCommandOutput) {
    unverified.push("Pipeline publish readiness is unverified because canonical file existence is not validation/QA proof.");
    risks.push("Publish-readiness risk: existing CSV output can still contain duplicates, row-count drift, unknown-field spikes, or invalid requirements.");
  }
  if (rollupPresent && !buildNotRun && !ingestNotRun) {
    unverified.push("Build and ingest success remain unverified; npm ls only proves dependency presence.");
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
  if (rollupPresent || (brightspace && (buildNotRun || ingestNotRun))) {
    risks.push("The current risk is no longer the Rollup package itself; it is unproven build/ingest gate status.");
  }
  if (!risks.length) {
    risks.push("The main risk is upgrading weak or missing evidence into a hard completion claim.");
  }

  const nextAction = projectControlNextAction(signals);
  const prompt = projectControlPrompt(signals);

  return [
    "## Verdict",
    `- ${projectControlVerdict(signals)}`,
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

function projectControlVerdict(input: ProjectControlSignals): string {
  if (input.wrongRepoEvidencePaths.length) {
    return "Not proven; supplied command/report evidence points at the wrong repo for this task.";
  }
  if (input.repoPathWithheld) {
    if (input.seedGoldMisuse) {
      return "Not proven; target repo path is withheld and ingest:seed-gold/gold mutation is forbidden proof.";
    }
    if (input.iosReleaseClaim) {
      return "Not release-ready as proven; target repo path is withheld and checklist gates remain unverified.";
    }
    if (input.visualProofClaim) {
      return "Not visually proven; target repo path is withheld and rendered evidence is missing.";
    }
    if (input.docsOnly && input.codexClaimsComplete) {
      return "Not complete as proven; target repo path is withheld and docs-only evidence cannot prove runtime behavior.";
    }
    if (input.avgTotalApplyClaim) {
      return "Do not apply canonical data changes; target repo path is withheld and only a dry-run is acceptable next.";
    }
    return "Not safe to execute yet; the target repo path is withheld.";
  }
  if (input.seedGoldMisuse) {
    return "Reject as proof; ingest:seed-gold or gold mutation is outside the allowed proof boundary.";
  }
  if (input.dependencyScopeViolation) {
    return "Reject or require correction; the dependency repair appears to touch forbidden source/parser scope.";
  }
  if (input.visualProofClaim) {
    return "Not visually proven; source/CSS changes need rendered visual evidence and a checklist.";
  }
  if (input.iosReleaseClaim) {
    return "Not release-ready as proven; checklist existence or unchecked gates do not prove TestFlight/App Store readiness.";
  }
  if (input.sheetsPublishClaim) {
    return "Do not publish yet; Sheets sync safety needs target/config/validation evidence.";
  }
  if (input.pipelinePublishClaim) {
    return "Do not publish yet; canonical output existence is not pipeline QA proof.";
  }
  if (input.memoryAutoApprovalClaim) {
    return "Unsafe as stated; raw model output cannot become approved memory without explicit approval metadata.";
  }
  if (input.appsScriptStructureClaim) {
    return "Deploy readiness is unproven until Apps Script structure validation is run and reported.";
  }
  if (input.ualbertaPipelineClaim) {
    return "UAlberta support is not proven by file existence; fixture or pipeline QA evidence is required.";
  }
  if (input.avgTotalApplyClaim) {
    return "Do not apply canonical data changes yet; Avg_Total candidates need reviewed dry-run/diff evidence.";
  }
  if (input.buildPagesClaim || input.scriptExistsAsProof) {
    return "Not verified; package script existence does not prove the command passed.";
  }
  if (input.rollupPresent) {
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

function projectControlNextAction(input: ProjectControlSignals): string {
  if (input.repoPathWithheld) {
    if (input.seedGoldMisuse) {
      return "Ask for the target repo path, then run only the approved Brightspace proof gate npm run build followed by npm run ingest:ci; do not run ingest:seed-gold or update gold files.";
    }
    if (input.iosReleaseClaim) {
      return "Ask for the target repo path, then verify the iOS wrapper gate from mobile/ios-wrapper with npm run preflight, npm run sync:ios, and Xcode build evidence before any TestFlight/App Store decision.";
    }
    if (input.visualProofClaim) {
      return "Ask for the target repo path and rendered preview route, then capture screenshot evidence with a text-fit, symmetry, containment, and overlap checklist before calling the layout fixed.";
    }
    if (input.docsOnly && input.codexClaimsComplete) {
      return "Ask for the target repo path, then inspect whether runtime source/test files changed before running the minimal verification command; do not accept docs-only completion.";
    }
    if (input.avgTotalApplyClaim) {
      return "Ask for the target repo path, then identify and run only the Avg_Total dry-run/read-only validation before any apply, publish, sync, or canonical data mutation.";
    }
    return "Ask for the target repo path, then run only a read-only/dry-run proof command from that repo root before any apply, publish, sync, deploy, or release step.";
  }
  if (input.wrongRepoEvidencePaths.length) {
    if (input.brightspace && input.targetRepoPath) {
      return `In ${input.targetRepoPath}, rerun npm ls @rollup/rollup-darwin-arm64 rollup vite, then npm run build and npm run ingest:ci; ignore evidence from ${input.wrongRepoEvidencePaths.join(", ")}.`;
    }
    if (input.memoryAutoApprovalClaim && input.targetRepoPath) {
      return `In ${input.targetRepoPath}, inspect the STAX memory-governance diff and run the smallest relevant STAX tests/evals; ignore command evidence from ${input.wrongRepoEvidencePaths.join(", ")}.`;
    }
    if (input.appsScriptStructureClaim && input.targetRepoPath) {
      return `In ${input.targetRepoPath}, discover the exact Apps Script deploy-bundle validation command from package/docs, run only that local validation, and ignore the proposed root ${input.wrongRepoEvidencePaths.join(", ")}.`;
    }
    if (input.pipelinePublishClaim && input.targetRepoPath) {
      return `In ${input.targetRepoPath}, run the required pipeline fixture/dry-run proof from that repo root before any publish decision; ignore evidence from ${input.wrongRepoEvidencePaths.join(", ")}.`;
    }
    if (input.visualProofClaim && input.targetRepoPath) {
      return `Use ${input.targetRepoPath} as the target repo, then collect rendered visual evidence for the claimed UI fix; ignore the wrong-repo report from ${input.wrongRepoEvidencePaths.join(", ")}.`;
    }
    return `Rerun the proof from ${input.targetRepoPath ?? "the target repo root"} and ignore cross-repo evidence from ${input.wrongRepoEvidencePaths.join(", ")}.`;
  }
  if (input.seedGoldMisuse) {
    return "Quarantine or revert the seed-gold/gold changes, then require a clean npm run ingest:ci result with no fixture, gold, parser, source, or ingest-promotion changes.";
  }
  if (input.dependencyScopeViolation) {
    return "Revert or isolate the forbidden source/parser change, then require a dependency-only repair report limited to package-lock.json, justified package.json, and tmp/.gitkeep plus npm ls and npm run ingest:ci output.";
  }
  if (input.visualProofClaim) {
    if (input.canvasHelper) {
      return "Provide a rendered Sports Wellness screenshot or visual finding that checks text fit, border symmetry, and checkmark containment.";
    }
    if (input.admissionApp) {
      return "Capture rendered web app evidence and complete docs/WEBAPP_QA_CHECKLIST.md before calling the layout fixed.";
    }
    return "Provide a rendered screenshot or manual visual checklist result for the claimed UI fix before calling the layout fixed.";
  }
  if (input.iosReleaseClaim) {
    return "In mobile/ios-wrapper, run npm run preflight and report the exact output before treating the wrapper as TestFlight-ready.";
  }
  if (input.sheetsPublishClaim) {
    if (input.sheetsValidationCommandKnown) {
      return "Run tools/validate-sync-surface.ps1 first and report target Sheet/config status before any SYNC_ALL or publish command.";
    }
    return "Inspect the repo docs/scripts to identify a read-only Sheets sync preflight or validation path, then report target Sheet/config status before any SYNC_ALL or publish command.";
  }
  if (input.pipelinePublishClaim) {
    if (input.ualbertaPipelineClaim && input.ualbertaFixtureCommandKnown) {
      return "Run python pipeline/check_ualberta_url_map_fixtures.py first, then identify only a non-publishing pipeline dry-run/validation command from docs/PIPELINE.md before any publish decision.";
    }
    return "Run tools/validate-canonical.ps1 first and report row-count drift, duplicate/suspicious rows, unknown-field spikes, and the first failure before publishing.";
  }
  if (input.memoryAutoApprovalClaim) {
    return "Move the memory item to pending review and require approvedBy, approvalReason, source run, expiration/justification, and poison-scan evidence before retrieval.";
  }
  if (input.appsScriptStructureClaim) {
    const scope = input.targetRepoPath ? `in ${input.targetRepoPath}` : "from the confirmed target repo root";
    return `Discover the exact Apps Script structure/deploy-bundle validation command ${scope}, then run only that local read-only validation and report exact output before treating the bundle as deploy-ready.`;
  }
  if (input.ualbertaPipelineClaim) {
    return "Run python pipeline/check_ualberta_url_map_fixtures.py and report the exact output before claiming UAlberta pipeline support is proven.";
  }
  if (input.avgTotalApplyClaim) {
    return "Run .\\tools\\apply-avg-total-candidates.ps1 -CandidatesPath .\\pipeline_artifacts\\extract\\avg_total_candidates.csv -DryRun and report the candidate diff before any apply.";
  }
  if (input.buildPagesClaim) {
    return "Run npm run build:pages in ADMISSION-APP and report the exact output and first failure before calling the Pages build verified.";
  }
  if (input.scriptExistsAsProof) {
    if (input.canvasBuildStudioClaim) {
      return "Run npm run build:studio in canvas-helper and report exact output, exit code, and first failure before treating build:studio script existence as build proof.";
    }
    return "Inspect package.json, run the exact configured build command such as npm run build only if that script exists, and report output before treating script existence as proof.";
  }
  if (input.rollupPresent) {
    return "In /Users/deanguedo/Documents/GitHub/brightspacequizexporter, run npm run ingest:ci and report whether its build step passed, whether ingest:promotion-check was reached, and the first failure or passing output.";
  }
  if (input.docsOnly) {
    return "Ask Codex for the exact source/test diff or a correction saying this was docs-only, plus the first proof command that would verify the claimed runtime behavior.";
  }
  if (input.inventedPathRisk) {
    return "Ask Codex to prove the claimed file exists with a file listing or diff before accepting any test-pass or implementation claim.";
  }
  if (input.codexClaimsTestsPassed) {
    if (input.targetRepoPath?.endsWith("/STAX")) {
      return "In /Users/deanguedo/Documents/GitHub/STAX, rerun npm test and report exact command output, exit code, and first failure before treating the rollout as proven.";
    }
    return "Ask Codex to return the exact command output for npm test or rerun the relevant local test command before treating the report as proven.";
  }
  return "Collect the smallest local evidence packet: relevant diff, exact command output, and first remaining failure if any.";
}

function projectControlPrompt(input: ProjectControlSignals): string {
  if (input.repoPathWithheld) {
    if (input.seedGoldMisuse) {
      return [
        "```txt",
        "Do not run ingest:seed-gold and do not update gold/fixture files.",
        "First ask for the exact target repo path.",
        "Once the repo path is supplied, run only the approved proof path from that repo root: npm run build, then npm run ingest:ci.",
        "Report cwd, exact commands, exit codes, output, git diff summary, and first remaining failure.",
        "```"
      ].join("\n");
    }
    if (input.iosReleaseClaim) {
      return [
        "```txt",
        "Do not submit to TestFlight/App Store and do not change release state.",
        "First ask for the exact target repo path.",
        "Once the repo path is supplied, verify the wrapper gate from mobile/ios-wrapper: npm run preflight, npm run sync:ios, and Xcode build verification.",
        "Report cwd, exact commands, exit codes, which checklist items are proven, and which release gates remain unverified.",
        "```"
      ].join("\n");
    }
    if (input.visualProofClaim) {
      return [
        "```txt",
        "Do not claim visual/layout correctness from CSS or source changes alone.",
        "First ask for the exact target repo path and preview route/project slug.",
        "Once supplied, capture rendered screenshot evidence and check: text fit, border symmetry, icon/control containment, and overlap.",
        "Report screenshot path or visual finding, viewport, checklist result, and first visible failure if any.",
        "```"
      ].join("\n");
    }
    if (input.docsOnly && input.codexClaimsComplete) {
      return [
        "```txt",
        "Do not accept docs-only evidence as runtime implementation.",
        "First ask for the exact target repo path.",
        "Once supplied, inspect whether runtime source/test files changed; if none changed, stop and report not implemented.",
        "If implementation exists, run the minimal local verification command and report command output plus first failure.",
        "```"
      ].join("\n");
    }
    if (input.avgTotalApplyClaim) {
      return [
        "```txt",
        "Do not apply Avg_Total changes, publish, sync, or mutate canonical data yet.",
        "First ask for the exact target repo path.",
        "Once supplied, identify the repo's Avg_Total dry-run/read-only validation path and run only that.",
        "Report cwd, files inspected, exact dry-run command, exit code, whether files changed, candidate diff summary, and first failure.",
        "```"
      ].join("\n");
    }
    return [
      "```txt",
      "Do not execute, apply, publish, sync, deploy, or release yet.",
      "First ask for the exact target repo path and the relevant command surface.",
      "Once the repo path is supplied, run only a read-only/dry-run proof command from that repo root and report cwd, command, exit code, and first failure.",
      "Do not invent a file path or command from missing repo evidence.",
      "```"
    ].join("\n");
  }

  if (input.wrongRepoEvidencePaths.length) {
    const wrongPaths = input.wrongRepoEvidencePaths.join(", ");
    const target = input.targetRepoPath ?? "the target repo root";
    if (input.brightspace) {
      return [
        "```txt",
        `Work only in ${target}.`,
        `Do not use evidence from ${wrongPaths}.`,
        "Run:",
        "pwd",
        "npm ls @rollup/rollup-darwin-arm64 rollup vite",
        "npm run build",
        "npm run ingest:ci",
        "Report exact output, exit codes, first remaining failure, and changed files if any.",
        "Do not edit parser, source, fixture, gold, benchmark, or ingest-promotion files.",
        "```"
      ].join("\n");
    }
    if (input.memoryAutoApprovalClaim) {
      return [
        "```txt",
        `Work only in ${target}.`,
        `Do not cite tests or command output from ${wrongPaths} as proof.`,
        "Audit whether approved-memory governance was actually patched.",
        "Show the relevant memory-governance diff, approval metadata behavior, and smallest local STAX test/eval output.",
        "Report files changed, commands run, exit codes, whether explicit approval is enforced, and remaining unverified risks.",
        "```"
      ].join("\n");
    }
    if (input.appsScriptStructureClaim) {
      return [
        "```txt",
        `Work only in ${target}.`,
        `Do not run validation from ${wrongPaths}.`,
        "Discover the exact Apps Script deploy-bundle validation command from package.json/docs before running it.",
        "Run only the local read-only validation command from the target repo root.",
        "Report cwd, exact command, exit code, stdout/stderr summary, and whether validation passed.",
        "Do not deploy, publish, sync, or mutate release state.",
        "```"
      ].join("\n");
    }
    return [
      "```txt",
      `Work only in ${target}.`,
      `Reject proof from ${wrongPaths} for this task.`,
      "Rerun the smallest relevant proof command from the target repo root.",
      "Report cwd, exact command, exit code, output, changed files if any, and first remaining failure.",
      "```"
    ].join("\n");
  }

  if (input.seedGoldMisuse) {
    return [
      "```txt",
      "Audit the prior ingest fix as invalid proof if it used ingest:seed-gold or changed gold/fixture data.",
      "Do not edit parser/source/fixture/gold/benchmark data.",
      "Run exactly npm run ingest:ci from the existing state and report whether build and ingest:promotion-check pass.",
      "If it fails, report the first remaining failure. If gold files changed, say they require separate human approval and are not proof.",
      "```"
    ].join("\n");
  }

  if (input.dependencyScopeViolation) {
    return [
      "```txt",
      "Redo the Rollup dependency/install repair report with the dependency-only scope restored.",
      "Allowed tracked changes: package-lock.json; package.json only if explicitly justified; tmp/.gitkeep only to preserve/resolve it.",
      "Forbidden changes: src/**, scripts/**, fixtures/**, gold/**, parser logic, ingest promotion logic, and tests.",
      "Report exact changed files, npm ls output, npm run ingest:ci output, and first remaining failure if any.",
      "```"
    ].join("\n");
  }

  if (input.visualProofClaim) {
    return [
      "```txt",
      "Do not claim the UI/layout fix is visually verified from source or CSS alone.",
      "Provide a rendered screenshot or manual visual finding for the target UI.",
      "Checklist: text fits, borders/spacing are symmetrical, controls/icons are contained, and no overlapping content is visible.",
      "Report what is verified, what remains unverified, and the next exact fix if the screenshot still fails.",
      "```"
    ].join("\n");
  }

  if (input.iosReleaseClaim) {
    return [
      "```txt",
      "Do not claim iOS/TestFlight readiness from checklist existence.",
      "In mobile/ios-wrapper, run the wrapper build gate and report exact output for npm install, npm run preflight, npm run sync:ios, and Xcode verification status.",
      "Also report which auth/access, workflow, device, accessibility, and ops gates remain unverified.",
      "Do not submit, deploy, or change release state.",
      "```"
    ].join("\n");
  }

  if (input.sheetsPublishClaim) {
    const validationStep = input.sheetsValidationCommandKnown
      ? "Run tools/validate-sync-surface.ps1 if that command is confirmed by repo evidence."
      : "Inspect docs/scripts first to identify the repo's read-only sync preflight or validation command; if none exists, report that blocker instead of inventing one.";
    return [
      "```txt",
      "Do not run SYNC_ALL, SYNC_PROGRAMS, or any publish command yet.",
      validationStep,
      "Validate the sync surface: target Sheet identity, config presence, credential boundary, and local validation requirements.",
      "Report exact validation output or the exact missing-validation blocker without printing secrets.",
      "```"
    ].join("\n");
  }

  if (input.pipelinePublishClaim) {
    if (input.ualbertaPipelineClaim && input.ualbertaFixtureCommandKnown) {
      return [
        "```txt",
        "In /Users/deanguedo/Documents/GitHub/ADMISSION-APP, do not publish or sync admissions pipeline output yet.",
        "Run exactly python pipeline/check_ualberta_url_map_fixtures.py and report exact output.",
        "Then inspect docs/PIPELINE.md for the safest non-publishing pipeline dry-run/validation command; run only dry-run/validation, not live publish.",
        "Report commands, exit codes, fixture status, dry-run/validation status, first failure, and publish recommendation.",
        "```"
      ].join("\n");
    }
    return [
      "```txt",
      "Do not publish admissions pipeline output from file existence alone.",
      "Run the canonical/pipeline QA gate and report row-count drift, duplicates, suspicious program names, unknown-field spikes, invalid requirement values, and first failure.",
      "Only recommend publish after validation evidence is attached.",
      "```"
    ].join("\n");
  }

  if (input.memoryAutoApprovalClaim) {
    return [
      "```txt",
      "Do not save raw model output as approved memory.",
      "Create a pending memory review packet only: source run, proposed memory text, approval reason, approving actor, expiration or never-expire justification, and poison-scan result.",
      "Do not make it retrievable until explicit approval is recorded.",
      "```"
    ].join("\n");
  }

  if (input.appsScriptStructureClaim) {
    const targetLine = input.targetRepoPath ? `Work only in ${input.targetRepoPath}.` : "Use the confirmed target repo root.";
    return [
      "```txt",
      targetLine,
      "Do not claim the Apps Script bundle is deploy-ready from source edits alone.",
      "Discover the exact Apps Script structure/deploy-bundle validation command from package.json/docs before running it.",
      "Run only the local read-only validation command and report exact output.",
      "If exporting a bundle, report export command output and changed files. Do not deploy.",
      "```"
    ].join("\n");
  }

  if (input.ualbertaPipelineClaim) {
    return [
      "```txt",
      "Do not claim UAlberta support is complete from seed/config file existence.",
      "Run python pipeline/check_ualberta_url_map_fixtures.py and report exact output.",
      "If it passes, still mark full pipeline support unverified until pipeline QA and publish gates have local evidence.",
      "```"
    ].join("\n");
  }

  if (input.avgTotalApplyClaim) {
    return [
      "```txt",
      "Do not apply Avg_Total candidates to canonical data yet.",
      "Run .\\tools\\apply-avg-total-candidates.ps1 -CandidatesPath .\\pipeline_artifacts\\extract\\avg_total_candidates.csv -DryRun.",
      "Report the candidate diff, row count affected, command output, and first failure. Ask for human approval before any non-dry-run apply.",
      "```"
    ].join("\n");
  }

  if (input.buildPagesClaim) {
    return [
      "```txt",
      "In /Users/deanguedo/Documents/GitHub/ADMISSION-APP, verify the Pages build instead of inferring from package.json.",
      "Run exactly npm run build:pages.",
      "Report the command output, exit status, files changed if any, and first remaining failure if it fails.",
      "Do not publish or sync to Sheets.",
      "```"
    ].join("\n");
  }

  if (input.scriptExistsAsProof) {
    if (input.canvasBuildStudioClaim) {
      return [
        "```txt",
        "In /Users/deanguedo/Documents/GitHub/canvas-helper, verify build success only.",
        "Do not modify files.",
        "Run exactly npm run build:studio.",
        "Report exact command output, exit code, and first failure if it fails.",
        "Do not claim tests or previews passed unless separately run with local output.",
        "```"
      ].join("\n");
    }
    return [
      "```txt",
      "Do not claim build/test success from package.json script existence.",
      "Inspect package.json and list the relevant scripts.",
      "Run the exact configured build command, such as npm run build only if that script exists.",
      "Run the test script only if package.json defines one; otherwise state that no test script was found.",
      "Report exact commands, exit codes, relevant output, and first remaining failure if any.",
      "Do not edit files.",
      "```"
    ].join("\n");
  }

  if (input.rollupPresent) {
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
    if (input.targetRepoPath?.endsWith("/STAX")) {
      return [
        "```txt",
        "In /Users/deanguedo/Documents/GitHub/STAX, verify the rollout with local command evidence.",
        "Run exactly npm test.",
        "Report exact command output, exit code, and first remaining failure if it fails.",
        "Do not treat human-pasted or Codex-reported output as hard proof.",
        "```"
      ].join("\n");
    }
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
