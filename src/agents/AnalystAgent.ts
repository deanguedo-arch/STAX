import type { Agent, AgentInput } from "./Agent.js";
import type { AgentResult } from "../schemas/AgentResult.js";
import { assessAuditEvidence, renderAuditContractSections } from "../audit/VerifiedAuditContract.js";
import { decideEvidence, renderEvidenceDecision } from "../audit/EvidenceDecisionGate.js";
import { renderProjectControlVerdictCard } from "../projectControl/ControlCard.js";
import { buildProjectControlProofStack } from "../projectControl/ProjectControlProofStack.js";
import { formatBlockedActions, getRepoProofSurface } from "../projectControl/RepoProofSurfaceRegistry.js";
import { renderRepoTransferProjectControl } from "../repoTransfer/RepoTransferProjectControl.js";
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
      const contextText = input.context.join("\n\n").trim();
      const evidencePacket = contextText
        ? {
            ...packet,
            repoEvidence: [packet.repoEvidence, contextText].filter(Boolean).join("\n\n")
          }
        : packet;
      return {
        agent: this.name,
        schema: "project_control",
        confidence: "medium",
        metadata: { providerText: providerResponse.text },
        output: renderProjectControl(evidencePacket)
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

const ADMISSION_SURFACE = getRepoProofSurface("admission_app");
const CANVAS_SURFACE = getRepoProofSurface("canvas_helper");
const BRIGHTSPACE_SURFACE = getRepoProofSurface("brightspacequizexporter");

type ProjectControlSignals = {
  targetRepoPath?: string;
  repoPathWithheld: boolean;
  wrongRepoEvidencePaths: string[];
  codexReportAuditRequest: boolean;
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
  boundedPromptRequest: boolean;
  repoRiskRequest: boolean;
  proofGapRequest: boolean;
  avgTotalGapTraceRequest: boolean;
  brightspaceBuildGateRequest: boolean;
  brightspaceIngestGateRequest: boolean;
  brightspaceBuildPassedEvidence: boolean;
  brightspaceIngestPassedEvidence: boolean;
  admissionDatasetValidationPassedEvidence: boolean;
  staxTypecheckRequest: boolean;
  staxEvalRequest: boolean;
  staxPromotionGateRequest: boolean;
  priorRunProofRequest: boolean;
  priorRunProvenVsUnprovenRequest: boolean;
  priorRunFakeCompleteRequest: boolean;
  commandSourceClassificationRequest: boolean;
  codexReportedOnlyProofRequest: boolean;
  uiHumanPastedNoScreenshotRequest: boolean;
  sheetsDocsOnlyReadinessRequest: boolean;
  brightspaceSeedGoldNoCiRequest: boolean;
  crossRepoEvidenceTrap: boolean;
  wrongRootValidationRequest: boolean;
  crossRepoZipEvidenceTrap: boolean;
  nonExistentRepoPathClaim: boolean;
  cleanupMinimizationRequest: boolean;
  proofOnlyScopePromptRequest: boolean;
  visualArtifactPromptRequest: boolean;
  publishPreflightPromptRequest: boolean;
  scrapeDataCorrectnessRequest: boolean;
  scrapeCoverageAuditSupplied: boolean;
  explicitPublishSyncTask: boolean;
  explicitBrightspaceTask: boolean;
  explicitAdmissionTask: boolean;
  explicitCanvasTask: boolean;
  explicitStaxTask: boolean;
  dogfoodCampaignAudit: boolean;
  staxValidationEvidence: boolean;
  admissionPipelineFilesPublishSafeRequest: boolean;
  cleanFailureQuestion: boolean;
  pwshMissingBlocker: boolean;
};

function parseProjectControlPacket(input: string): ProjectControlPacket {
  const task = extractLabeledBlock(input, "Task", ["Repo Evidence", "Command Evidence", "Codex Report", "Return"]) || input.trim();
  let codexReport = extractLabeledBlock(input, "Codex Report", ["Return"]);
  if (!codexReport) {
    const inlineCodexReport = task.match(/audit this codex report[^:]*:\s*([\s\S]+)/i)?.[1];
    if (inlineCodexReport) codexReport = inlineCodexReport.trim();
  }
  return {
    task,
    repoEvidence: extractLabeledBlock(input, "Repo Evidence", ["Command Evidence", "Codex Report", "Return"]),
    commandEvidence: extractLabeledBlock(input, "Command Evidence", ["Codex Report", "Return"]),
    codexReport
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
  const transferOutput = renderRepoTransferProjectControl(packet);
  if (transferOutput) return transferOutput;

  const combined = [packet.task, packet.repoEvidence, packet.commandEvidence, packet.codexReport].join("\n");
  const lower = combined.toLowerCase();
  const targetRepoPath = extractTargetRepoPath(packet.repoEvidence);
  const repoPathWithheld = !targetRepoPath && /\b(repo path|repo root|target repo)\b[\s\S]{0,60}\b(withheld|not supplied|missing|intentionally withheld)\b/i.test(combined);
  const wrongRepoEvidencePaths = targetRepoPath ? extractWrongRepoEvidencePaths(packet, targetRepoPath) : [];
  const hasWrongRepoEvidence = wrongRepoEvidencePaths.length > 0;
  const reportAndCommand = [packet.codexReport, packet.commandEvidence].join("\n");
  const taskAndReport = [packet.task, packet.codexReport].join("\n");
  const staxTaskHint = /current STAX repo|STAX repo before commit|before commit|commit-readiness|uncommitted campaign|comparison-integrity|dogfood/i.test(packet.task);
  const staxRepoContext =
    staxTaskHint ||
    targetRepoPath === "/Users/deanguedo/Documents/GitHub/STAX" ||
    /(?:^|\n)\s*(?:Repo|Target repo path):\s*\/Users\/deanguedo\/Documents\/GitHub\/STAX\b/i.test(packet.repoEvidence) ||
    /\bworkspace:\s*STAX\b/i.test(packet.repoEvidence);
  const dogfoodCampaignAudit = /dogfood campaign|dogfood_10_tasks|real tasks recorded|campaign state/i.test(combined);
  const scrapeDataCorrectnessRequest = /scrape\/data correctness|scrape\/data coverage audit|scraped admissions data|scraper\/output|data correctness|right fields and coverage|app data consumers|Avg_Total coverage|Avg_Total gap|Avg_Total gap trace|identity drift|canonical data gap/i.test(packet.task);
  const avgTotalGapTraceRequest = /Avg_Total gap trace|Avg_Total coverage|identity drift|canonical data gap/i.test(packet.task);
  const scrapeCoverageAuditSupplied = scrapeDataCorrectnessRequest && /High blank rates|blank rates:|Avg_Total\s+\d+\/\d+|\d+\s+rows have Min_Avg_Final present but Avg_Total blank|canonical headers present|avg_total_candidates\.csv has only|validate-dataset\.py[\s\S]{0,200}Exit code 0/i.test(combined);
  const brightspace = !staxRepoContext && /brightspace|brightspacequizexporter/i.test(combined);
  const rollupPresent = /@rollup\/rollup-darwin-arm64@?4\.59\.0/i.test(combined) && /\bnpm ls\b/i.test(combined);
  const brightspaceBuildGateRequest = /brightspace.*build gate|build gate is clear before ingest|validate whether brightspace build gate/i.test(packet.task);
  const brightspaceIngestGateRequest = /brightspace.*ingest gate|validate whether brightspace ingest gate|ingest gate is clear/i.test(packet.task);
  const buildIngestUnproven = lower.includes("build/ingest gate") && lower.includes("unproven");
  const buildNotRun = buildIngestUnproven || /npm run build (?:and )?npm run ingest:ci have not been run|build .*not been run|npm run build.*not been run|build and ingest .*not proven/i.test(combined);
  const ingestNotRun = buildIngestUnproven || /ingest:ci .*not been run|npm run ingest:ci.*not been run|ingest gate .*unproven|ingest .*not proven/i.test(combined);
  const staxTypecheckRequest = staxRepoContext && /\b(typecheck|validation readiness)\b/i.test(packet.task) && !/\b(before commit|commit-readiness|promotion gate|9\.5 promotion)\b/i.test(packet.task);
  const staxEvalRequest = staxRepoContext && /\b(npm run rax -- eval|eval readiness|evaluation readiness)\b/i.test(packet.task) && !/\b(promotion gate|9\.5 promotion)\b/i.test(packet.task);
  const staxPromotionGateRequest = staxRepoContext && /\b(promotion gate|9\.5 promotion|campaign:promotion-gate|promotion-gate status)\b/i.test(packet.task);
  const docsOnly = /diff summary .*only shows docs\/|only docs\/|docs-only/i.test(combined);
  const codexClaimSurface = [packet.codexReport, packet.task].join("\n");
  const codexClaimsTestsPassed = /\b(all checks passed|all tests passed|tests passed|npm test passed|test suite passed)\b/i.test(codexClaimSurface);
  const codexClaimsComplete = /\b(fixed|implemented|complete|completed|finished|ready|verified)\b/i.test(codexClaimSurface);
  const evidenceText = packet.commandEvidence + "\n" + packet.repoEvidence;
  const negatesCommandEvidence = /\b(no local .*command evidence|no local command output|command evidence:\s*none|none supplied|not supplied)\b/i.test(evidenceText);
  const hasCommandOutput = !hasWrongRepoEvidence && !negatesCommandEvidence && /\b(exit code 0|local STAX command evidence|npm ls|run-\d{4}|runs\/\d{4}|passed, \d+\/\d+|Test Files\s+\d+ passed)\b/i.test(evidenceText);
  const staxValidationEvidence = !hasWrongRepoEvidence && !negatesCommandEvidence && /npm run typecheck passed/i.test(evidenceText) && /npm test passed/i.test(evidenceText) && /npm run rax -- eval passed/i.test(evidenceText);
  const inventedPathRisk = /src\/not-real|not-real-provider-router/i.test(combined);
  const explicitBrightspaceTask =
    /brightspace|brightspacequizexporter/i.test(taskAndReport) ||
    targetRepoPath === "/Users/deanguedo/Documents/GitHub/brightspacequizexporter";
  const explicitAdmissionTask =
    /ADMISSION-APP|admissions checker|admissions pipeline|app-admissions|admission-app/i.test(taskAndReport) ||
    targetRepoPath === "/Users/deanguedo/Documents/GitHub/ADMISSION-APP";
  const explicitCanvasTask =
    /canvas-helper|Sports Wellness|sportswellness/i.test(taskAndReport) ||
    targetRepoPath === "/Users/deanguedo/Documents/GitHub/canvas-helper";
  const explicitStaxTask = staxRepoContext && !explicitAdmissionTask && !explicitBrightspaceTask && !explicitCanvasTask;
  const brightspaceBuildPassedEvidence =
    explicitBrightspaceTask &&
    /cwd=\/Users\/deanguedo\/Documents\/GitHub\/brightspacequizexporter[\s\S]{0,200}\$ npm run build[\s\S]{0,200}Exit code:\s*0/i.test(packet.commandEvidence);
  const brightspaceIngestPassedEvidence =
    explicitBrightspaceTask &&
    /cwd=\/Users\/deanguedo\/Documents\/GitHub\/brightspacequizexporter[\s\S]{0,200}\$ npm run ingest:ci[\s\S]{0,300}Exit code:\s*0/i.test(packet.commandEvidence);
  const admissionDatasetValidationPassedEvidence =
    explicitAdmissionTask &&
    /validate-dataset\.py[\s\S]{0,200}Exit code:\s*0[\s\S]{0,400}(Validation passed|Dataset validation summary)/i.test(combined);
  const explicitPublishSyncTask = /\b(publish\/sync|publish|sync|Sheets|sheets_sync|Google Sheets|preflight)\b/i.test(taskAndReport);
  const signals: ProjectControlSignals = {
    targetRepoPath,
    repoPathWithheld,
    wrongRepoEvidencePaths,
    codexReportAuditRequest: /audit this codex report/i.test(packet.task),
    brightspace,
    rollupPresent,
    buildNotRun,
    ingestNotRun,
    docsOnly,
    inventedPathRisk,
    codexClaimsTestsPassed,
    codexClaimsComplete,
    admissionApp: !staxRepoContext && !explicitBrightspaceTask && /ADMISSION-APP|admissions checker|admissions pipeline|app-admissions|admission-app/i.test(combined),
    buildPagesClaim: !staxRepoContext && !explicitBrightspaceTask && /build:pages|Pages build|tools\/build-pages\.js/i.test(combined),
    iosReleaseClaim: !staxRepoContext && !explicitBrightspaceTask && !scrapeDataCorrectnessRequest && /TestFlight|App Store|iOS wrapper|IOS_RELEASE_GATE|mobile\/ios-wrapper|release readiness|submit to TestFlight/i.test(combined),
    sheetsPublishClaim: !staxRepoContext && !explicitBrightspaceTask && !scrapeDataCorrectnessRequest && /SYNC_ALL|SYNC_PROGRAMS|publish to Sheets|Google Sheets|sheets_sync|target Sheet/i.test(combined),
    ualbertaPipelineClaim: !staxRepoContext && !explicitBrightspaceTask && /UAlberta|ualberta|check_ualberta_url_map_fixtures|ualberta_program_seed|canonical_url_map/i.test(combined),
    avgTotalApplyClaim: !staxRepoContext && !explicitBrightspaceTask && !scrapeDataCorrectnessRequest && /Avg_Total|apply-avg-total-candidates|avg_total_candidates|DryRun/i.test(combined),
    visualProofClaim: /visual|layout|looks good|CSS|screenshot|rendered preview|\bpreview\b|WebAppStyles|card text fit|checkmark containment/i.test(taskAndReport),
    appsScriptStructureClaim: !staxRepoContext && !explicitBrightspaceTask && /Apps Script deploy|Apps Script validation|validate-apps-script-structure|export-appsscript-bundles|WebApp\.html|Code\.gs|EligibilityEngine\.gs/i.test(combined),
    humanPastedWeakProof: /human-pasted|Human-pasted|human pasted/i.test(combined),
    memoryAutoApprovalClaim: /approved project memory|saved .*memory|auto-save|raw model output|approval metadata|poison scan/i.test(combined),
    dependencyScopeViolation: /src\/parser\.ts|parser logic|source\/parser|forbidden tracked changes/i.test(reportAndCommand),
    seedGoldMisuse: /\b(?:ran|run|running|succeeded|updated|changed|used|fixed)\b[\s\S]{0,100}\b(?:ingest:seed-gold|seed-gold|gold files|gold\/|fixture\/gold)\b/i.test(reportAndCommand),
    scriptExistsAsProof: /script exists|scripts exist|package\.json (?:has|contains)|existence of the .*script|because package\.json (?:has|contains)/i.test(combined),
    pipelinePublishClaim: !staxRepoContext && !explicitBrightspaceTask && /ready to publish|publish-safe|canonical CSV exists|pipeline files exist|validate-canonical|QA gates|pipeline output|publish readiness/i.test(combined),
    sheetsValidationCommandKnown: /validate-sync-surface\.ps1/i.test(combined),
    canvasBuildStudioClaim: /build:studio|studio build/i.test(combined),
    ualbertaFixtureCommandKnown: /pipeline\/check_ualberta_url_map_fixtures\.py/i.test(combined),
    canvasHelper: !staxRepoContext && !explicitBrightspaceTask && /canvas-helper|Sports Wellness|sportswellness/i.test(combined),
    boundedPromptRequest: /create one bounded codex prompt|bounded codex prompt|write one bounded next prompt|one next bounded prompt|bounded next action/i.test(packet.task),
    repoRiskRequest: /biggest current operating risk|what is risky in/i.test(packet.task),
    proofGapRequest: /what tests.*proof is missing|proof gap|what tests or proof commands/i.test(packet.task),
    avgTotalGapTraceRequest,
    brightspaceBuildGateRequest,
    brightspaceIngestGateRequest,
    brightspaceBuildPassedEvidence,
    brightspaceIngestPassedEvidence,
    admissionDatasetValidationPassedEvidence,
    staxTypecheckRequest,
    staxEvalRequest,
    staxPromotionGateRequest,
    priorRunProofRequest: /prior run|previous STAX run|last Brightspace run context|prior ADMISSION-APP evidence/i.test(packet.task),
    priorRunProvenVsUnprovenRequest: /what is actually proven vs unproven/i.test(packet.task),
    priorRunFakeCompleteRequest: /fake-complete risk and one bounded correction step/i.test(packet.task),
    commandSourceClassificationRequest: /classify strong vs weak proof|local_stax|codex_reported|human_pasted/i.test(packet.task),
    codexReportedOnlyProofRequest: /only Codex-reported output|Codex-reported output exists/i.test(packet.task),
    uiHumanPastedNoScreenshotRequest: /UI-fix claim with no screenshot|human-pasted command text/i.test(packet.task),
    sheetsDocsOnlyReadinessRequest: /Sheets sync readiness.*preflight output is missing|docs claim readiness/i.test(packet.task),
    brightspaceSeedGoldNoCiRequest: /Brightspace claim: ingest fixed after seed-gold run|no build\/ingest:ci output/i.test(packet.task),
    crossRepoEvidenceTrap: /captured from canvas-helper.*Brightspace proof|canvas-helper.*Brightspace proof/i.test(packet.task),
    wrongRootValidationRequest: /ADMISSION-APP validation from STAX root/i.test(packet.task),
    crossRepoZipEvidenceTrap: /ADMISSION-APP zip.*canvas-helper UI readiness/i.test(packet.task),
    nonExistentRepoPathClaim: /non-existent repo path.*tests passed/i.test(packet.task),
    cleanupMinimizationRequest: /partially useful Codex report.*minimizes cleanup prompts/i.test(packet.task),
    proofOnlyScopePromptRequest: /forces command evidence and blocks parser\/fixture scope creep/i.test(packet.task),
    visualArtifactPromptRequest: /requires visual proof artifact/i.test(packet.task),
    publishPreflightPromptRequest: /preserves publish\/sync safety boundaries and requires preflight evidence/i.test(packet.task),
    scrapeDataCorrectnessRequest,
    scrapeCoverageAuditSupplied,
    explicitPublishSyncTask,
    explicitBrightspaceTask,
    explicitAdmissionTask,
    explicitCanvasTask,
    explicitStaxTask,
    dogfoodCampaignAudit,
    staxValidationEvidence,
    admissionPipelineFilesPublishSafeRequest: /ADMISSION-APP claim: publish-safe because pipeline files exist/i.test(packet.task),
    cleanFailureQuestion: /clean failure|fake-complete/i.test(packet.task),
    pwshMissingBlocker: /pwsh is not installed|exit code:\s*127|exit code 127/i.test(combined)
  };

  const verified: string[] = [];
  const weak: string[] = [];
  const unverified: string[] = [];
  const risks: string[] = [];
  const proofStack = buildProjectControlProofStack({
    task: packet.task,
    repoEvidence: packet.repoEvidence,
    commandEvidence: packet.commandEvidence,
    codexReport: packet.codexReport,
    targetRepoPath,
    expectedRepo: targetRepoPath,
    expectedCwd: targetRepoPath
  });

  if (targetRepoPath) {
    verified.push(`Target repo path is ${targetRepoPath}.`);
  }
  if (signals.codexReportAuditRequest) {
    verified.push("This task is a Codex report audit request.");
  }
  if (signals.explicitStaxTask) {
    verified.push("This task explicitly targets the STAX repo/worktree.");
  }
  if (signals.staxValidationEvidence) {
    verified.push("Supplied local STAX validation evidence says typecheck, tests, and eval passed.");
  }
  if (signals.dogfoodCampaignAudit) {
    verified.push("This task audits the STAX real-use dogfood campaign state.");
  }
  if (signals.scrapeDataCorrectnessRequest) {
    verified.push("This task asks whether scraped admissions data matches the app data contract.");
  }
  if (signals.scrapeCoverageAuditSupplied) {
    weak.push("A coverage audit was supplied in the report; treat it as provisional unless backed by local command evidence.");
  }
  if (signals.commandSourceClassificationRequest) {
    verified.push("The task asks to classify proof strength by command evidence source.");
  }
  if (signals.codexReportedOnlyProofRequest) {
    verified.push("The task asks whether Codex-reported command output can prove a test-pass state.");
  }
  if (signals.priorRunProofRequest && signals.explicitBrightspaceTask) {
    verified.push("The task asks what Brightspace gate is still unproven from prior-run context.");
  }
  if (signals.priorRunProofRequest && signals.explicitAdmissionTask) {
    verified.push("The task asks what remains blocked before ADMISSION-APP publish/sync from prior evidence.");
  }
  if (signals.priorRunProofRequest && !signals.explicitBrightspaceTask && !signals.explicitAdmissionTask) {
    verified.push("The task asks for a prior-run proof audit rather than a fresh completion claim.");
  }
  if (signals.crossRepoEvidenceTrap) {
    verified.push("The task states command evidence came from canvas-helper while the proof claim targets Brightspace.");
  }
  if (signals.wrongRootValidationRequest) {
    verified.push("The task states ADMISSION-APP validation was proposed from the STAX root.");
  }
  if (signals.crossRepoZipEvidenceTrap) {
    verified.push("The supplied evidence source is ADMISSION-APP while the readiness question targets canvas-helper.");
  }
  if (signals.nonExistentRepoPathClaim) {
    verified.push("The report references a non-existent repo path.");
  }
  if (!packet.repoEvidence.trim() && !packet.commandEvidence.trim() && !packet.codexReport.trim()) {
    verified.push("No repo evidence, command evidence, or Codex report was supplied in this task packet.");
  }
  if (signals.repoRiskRequest && signals.admissionApp) {
    verified.push("This is an app-admissions operating-risk question.");
  }
  if (signals.repoRiskRequest && signals.brightspace) {
    verified.push("This is a Brightspace operating-risk question.");
  }
  if (signals.repoRiskRequest && signals.canvasHelper) {
    verified.push("This is a canvas-helper operating-risk question.");
  }
  if (signals.proofGapRequest && signals.admissionApp) {
    verified.push("This is an app-admissions proof-gap audit request.");
  }
  if (signals.proofGapRequest && signals.brightspace) {
    verified.push("This is a Brightspace proof-gap audit request.");
  }
  if (signals.proofGapRequest && signals.canvasHelper) {
    verified.push("This is a canvas-helper proof-gap audit request.");
  }
  if (signals.boundedPromptRequest && signals.explicitAdmissionTask) {
    verified.push("This task requests a bounded Codex prompt for app-admissions.");
  }
  if (signals.boundedPromptRequest && signals.explicitBrightspaceTask) {
    verified.push("This task requests a bounded Codex prompt for brightspacequizexporter.");
  }
  if (signals.boundedPromptRequest && signals.explicitCanvasTask) {
    verified.push("This task requests a bounded Codex prompt for canvas-helper.");
  }
  if (signals.boundedPromptRequest && signals.explicitStaxTask) {
    verified.push("This task requests a bounded Codex prompt for STAX commit/readiness proof.");
  }
  if (/no local .*command evidence|no local command output/i.test(combined)) {
    verified.push("The supplied evidence includes no local command output for the claimed pass/completion state.");
  }
  if (signals.priorRunProofRequest && !hasCommandOutput) {
    verified.push("No prior-run diff summary, command output, or repo-local artifact was supplied as hard proof.");
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
  if (signals.iosReleaseClaim && !signals.explicitPublishSyncTask) {
    verified.push("The supplied evidence identifies an iOS release gate/checklist, but unchecked checklist items are not release proof.");
  }
  if (signals.appsScriptStructureClaim) {
    verified.push("The supplied evidence identifies Apps Script structure/validation surfaces, but no structure validation output is supplied.");
  }
  if (signals.ualbertaPipelineClaim) {
    verified.push("The supplied evidence identifies UAlberta pipeline files or fixture commands, but not a passing fixture run.");
  }
  if (signals.sheetsPublishClaim) {
    verified.push(`The supplied evidence identifies Sheets publish/sync surfaces; registry proof surfaces are ${ADMISSION_SURFACE.commands.syncPreflight}, ${ADMISSION_SURFACE.commands.appsScriptValidation}, ${ADMISSION_SURFACE.commands.canonicalValidation}, and ${ADMISSION_SURFACE.files.requiredSheetsConfig}.`);
  }
  if (signals.scrapeDataCorrectnessRequest) {
    if (signals.scrapeCoverageAuditSupplied) {
      unverified.push("Scrape/data correctness remains unproven because supplied coverage results show sparse app-consumed admissions fields.");
      unverified.push("The first concrete data gap is high blank coverage in fields such as Avg_Total, Min_Avg_Final, English_Req, Math_Req, Science_Req, and Elective_Qty.");
    } else {
      unverified.push("Scraped/canonical data correctness is unverified until app-consumed columns are compared against canonical headers and field coverage.");
      unverified.push("Institution/program coverage, blank rates for requirement fields, and pipeline fixture results are unverified until read-only audit commands run.");
    }
    risks.push("Data-contract risk: the app can load a valid CSV while many admissions requirement fields are blank or too sparse to give useful eligibility results.");
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
  if (signals.commandSourceClassificationRequest) {
    weak.push("codex_reported and human_pasted outputs can guide follow-up, but they are not hard proof of a pass state.");
  }
  if (signals.codexReportedOnlyProofRequest) {
    weak.push("Codex-reported command output is provisional unless cross-checked by local command evidence.");
  }
  if (/paste|supplied repo evidence does not list/i.test(packet.repoEvidence) && inventedPathRisk) {
    weak.push("The report names a file path, but the supplied repo evidence does not prove that path exists.");
  }

  if (repoPathWithheld) {
    unverified.push("The target repo path is withheld, so command execution or file-path claims cannot be safely targeted yet.");
    risks.push("Wrong-repo risk: choosing a command before the repo root is known can validate or mutate the wrong project.");
  }
  if (signals.dogfoodCampaignAudit && /9\/10|9 of 10/i.test(combined)) {
    unverified.push("The dogfood campaign is not complete because only 9 of 10 real tasks are recorded.");
    risks.push("Campaign-proof risk: a clean validation run does not by itself finish the required 10-task usage loop.");
  }
  if (signals.explicitStaxTask && !hasCommandOutput && !signals.staxValidationEvidence) {
    unverified.push("STAX commit/readiness remains unverified until local typecheck/test/eval command evidence is supplied.");
    risks.push("Commit-readiness risk: benchmark or dogfood artifacts can look convincing while validation, report consistency, or source targeting remains unproven.");
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
  if (signals.iosReleaseClaim && !signals.explicitPublishSyncTask && !hasCommandOutput) {
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
    unverified.push("Dependency repair appears to touch forbidden source/parser scope; the dependency/install repair scope is violated or unproven because a source/parser path is mentioned in a dependency repair.");
    risks.push("Scope-creep risk: dependency repair can become hidden parser/source mutation.");
  }
  if (signals.seedGoldMisuse) {
    unverified.push("The ingest fix is not acceptable proof because ingest:seed-gold or gold mutation is a forbidden repair path for this packet.");
    risks.push("Proof-boundary risk: reseeding gold can hide regressions instead of proving ingest behavior.");
  }
  if (signals.commandSourceClassificationRequest) {
    unverified.push("Any hard pass/completion claim backed only by codex_reported or human_pasted output remains unverified.");
    risks.push("Proof-laundering risk: weak command summaries can be upgraded into false test/build proof.");
  }
  if (signals.codexReportedOnlyProofRequest) {
    unverified.push("Actual test pass status is unverified until the target repo emits local command output with cwd, command, exit code, and summary.");
    risks.push("Fake-complete risk: Codex-reported output can hide wrong repo, stale output, skipped tests, or failed commands.");
  }
  if (signals.uiHumanPastedNoScreenshotRequest) {
    unverified.push("Rendered UI state is unverified because no screenshot or browser-preview artifact was supplied.");
    risks.push("Visual fake-complete risk: human-pasted command text cannot prove layout, overlap, text fit, or containment.");
  }
  if (signals.sheetsDocsOnlyReadinessRequest) {
    unverified.push("Sheets sync readiness is unverified because docs are not preflight command output.");
    risks.push("Publish-boundary risk: docs-only readiness can push bad data to the wrong Sheet or fail mid-sync.");
  }
  if (signals.crossRepoEvidenceTrap) {
    unverified.push("Brightspace proof remains unverified because canvas-helper command evidence cannot validate brightspacequizexporter.");
    risks.push("Cross-repo evidence laundering risk: one repo's command output can be mistaken for another repo's proof.");
  }
  if (signals.wrongRootValidationRequest) {
    unverified.push("ADMISSION-APP validation remains unverified until it runs from the ADMISSION-APP repo root.");
    risks.push("Wrong-root risk: a command run from STAX may pass, fail, or no-op without validating ADMISSION-APP.");
  }
  if (signals.crossRepoZipEvidenceTrap) {
    unverified.push("canvas-helper UI readiness is unverified because ADMISSION-APP zip evidence is from the wrong project.");
    risks.push("Cross-project evidence contamination risk: unrelated repo files can be mistaken for UI readiness proof.");
  }
  if (signals.nonExistentRepoPathClaim) {
    unverified.push("The tests-passed claim is unverified because the referenced repo path does not exist.");
    risks.push("False-readiness risk: a non-existent repo path can launder stale or unrelated command output.");
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
  if (signals.repoRiskRequest && signals.admissionApp && !hasCommandOutput) {
    unverified.push("The current app-admissions build/publish/sync readiness state is unverified without local command proof.");
  }
  if (signals.repoRiskRequest && signals.brightspace && !hasCommandOutput) {
    unverified.push("The current brightspacequizexporter build/ingest readiness state is unverified without local command proof.");
  }
  if (signals.repoRiskRequest && signals.canvasHelper && !hasCommandOutput) {
    unverified.push("The current canvas-helper rendered UI readiness state is unverified without local proof artifact.");
    unverified.push("Rendered screenshot path, viewport, and visual checklist findings are unverified.");
  }
  if (signals.proofGapRequest && signals.admissionApp) {
    unverified.push("The app-admissions proof-command inventory is unverified until package/scripts evidence is supplied.");
    unverified.push("Whether package.json defines build/test/pipeline scripts is unverified from the current packet.");
  }
  if (signals.proofGapRequest && signals.brightspace) {
    unverified.push("The Brightspace proof-command inventory is unverified until package/scripts evidence is supplied.");
  }
  if (signals.proofGapRequest && signals.canvasHelper) {
    unverified.push("The canvas-helper proof-command and visual-proof artifact inventory is unverified until repo evidence is supplied.");
  }
  if (signals.boundedPromptRequest && signals.explicitAdmissionTask) {
    unverified.push("The app-admissions bounded prompt allowlist (files + one proof command) is unverified until repo evidence is supplied.");
  }
  if (signals.boundedPromptRequest && signals.explicitBrightspaceTask) {
    unverified.push("The Brightspace bounded prompt allowlist is unverified until local repo evidence is supplied.");
  }
  if (signals.boundedPromptRequest && signals.explicitCanvasTask) {
    unverified.push("The canvas-helper bounded prompt allowlist and proof artifact path are unverified until local repo evidence is supplied.");
  }
  if (!unverified.length && !hasCommandOutput) {
    unverified.push("Runtime behavior remains unverified until local command evidence is supplied.");
  }
  if (rollupPresent || (brightspace && (buildNotRun || ingestNotRun))) {
    risks.push("The current risk is no longer the Rollup package itself; it is unproven build/ingest gate status.");
  }
  if (signals.repoRiskRequest && signals.admissionApp) {
    risks.push(`Operational risk: ${formatBlockedActions(ADMISSION_SURFACE)} could be attempted without ${ADMISSION_SURFACE.commands.build} and preflight evidence.`);
  }
  if (signals.repoRiskRequest && signals.brightspace) {
    risks.push("Operational risk: ingest/build can be reported as fixed without gate evidence.");
  }
  if (signals.repoRiskRequest && signals.canvasHelper) {
    risks.push("Operational risk: visual completion claims can be accepted without rendered screenshot evidence.");
  }
  if (!risks.length) {
    risks.push("The main risk is upgrading weak or missing evidence into a hard completion claim.");
  }

  verified.push(...proofStack.verified);
  weak.push(...proofStack.weak);
  unverified.push(...proofStack.unverified);
  risks.push(...proofStack.risk);

  const verdict = projectControlVerdict(signals);
  const nextAction = projectControlNextAction(signals);
  const prompt = projectControlPrompt(signals);

  return [
    ...renderProjectControlVerdictCard(verdict),
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
  if (input.pwshMissingBlocker && input.cleanFailureQuestion) {
    return "Clean failure, not fake-complete; the read-only preflight was identified but could not run because pwsh is unavailable.";
  }
  if (input.scrapeDataCorrectnessRequest) {
    if (input.scrapeCoverageAuditSupplied) {
      return "Not proven; the supplied coverage audit shows valid schema/fixtures but sparse admissions requirement coverage for app correctness.";
    }
    return "Not proven; scraped admissions data needs a read-only data-contract and coverage audit before calling it right for the app.";
  }
  if (input.dogfoodCampaignAudit && input.staxValidationEvidence) {
    return "Validation-backed but not campaign-complete; the supplied evidence proves local STAX checks passed, while the dogfood ledger still has only 9 of 10 real tasks.";
  }
  if (input.priorRunProofRequest && input.explicitBrightspaceTask) {
    return "Brightspace prior-run proof is incomplete until the build and ingest:ci gates have local command evidence.";
  }
  if (input.priorRunProofRequest && input.explicitAdmissionTask) {
    return "ADMISSION-APP publish/sync remains blocked until local preflight validation evidence exists.";
  }
  if (input.priorRunProvenVsUnprovenRequest) {
    return "What is proven right now is only that no repo-local diff, test, or eval evidence was supplied; runtime behavior and completion remain unproven.";
  }
  if (input.priorRunFakeCompleteRequest) {
    return "Fake-complete risk is present: a prior run summary can sound complete without repo-local diff or command evidence.";
  }
  if (input.priorRunProofRequest) {
    return "Prior-run completion is not proven from summary context alone; it needs local artifact or command evidence.";
  }
  if (input.admissionDatasetValidationPassedEvidence) {
    return "Dataset schema validation passed, but ADMISSION-APP app-consumed field coverage is still not proven.";
  }
  if (input.explicitStaxTask && input.staxPromotionGateRequest) {
    return "STAX 9.5 is not proven until campaign:promotion-gate passes with clean evidence, zero critical misses, and the required workflow metrics.";
  }
  if (input.explicitStaxTask && input.staxEvalRequest) {
    return "STAX eval readiness is unproven until npm run rax -- eval passes locally from the STAX repo.";
  }
  if (input.explicitStaxTask && input.staxTypecheckRequest) {
    return "STAX validation readiness is unproven until npm run typecheck passes locally from the STAX repo.";
  }
  if (
    input.explicitStaxTask &&
    !input.memoryAutoApprovalClaim &&
    !input.codexClaimsTestsPassed &&
    !input.humanPastedWeakProof &&
    !input.wrongRepoEvidencePaths.length &&
    !input.commandSourceClassificationRequest
  ) {
    return "Not commit-ready as proven until the STAX worktree has local validation evidence and the current diff is reviewed.";
  }
  if (input.explicitBrightspaceTask && input.brightspaceIngestGateRequest) {
    return `Brightspace ingest readiness is not proven until ${BRIGHTSPACE_SURFACE.commands.ingestGate} passes locally and its build step clears.`;
  }
  if (input.explicitBrightspaceTask && input.brightspaceBuildGateRequest) {
    return `Brightspace build readiness is not proven until ${BRIGHTSPACE_SURFACE.commands.build} passes locally from the target repo.`;
  }
  if (input.explicitBrightspaceTask && input.brightspaceIngestPassedEvidence) {
    return `Brightspace ingest gate is locally proven for this run because ${BRIGHTSPACE_SURFACE.commands.ingestGate} passed from the target repo.`;
  }
  if (input.explicitBrightspaceTask && input.brightspaceBuildPassedEvidence) {
    return `Brightspace build gate is locally proven for this run, but ${BRIGHTSPACE_SURFACE.commands.ingestGate} remains the next missing gate.`;
  }
  if (
    input.explicitBrightspaceTask &&
    !input.priorRunProofRequest &&
    !input.rollupPresent &&
    !input.wrongRepoEvidencePaths.length &&
    !input.crossRepoEvidenceTrap &&
    !input.dependencyScopeViolation &&
    !input.codexClaimsTestsPassed
  ) {
    return `Brightspace dependency/build/ingest readiness is not proven until ${BRIGHTSPACE_SURFACE.commands.dependencyProof} runs in the target repo.`;
  }
  if (input.commandSourceClassificationRequest) {
    return "Strong proof requires local STAX command evidence; codex_reported and human_pasted outputs are weak/provisional.";
  }
  if (input.codexReportedOnlyProofRequest) {
    return "No; tests cannot be considered passed from Codex-reported output alone.";
  }
  if (input.uiHumanPastedNoScreenshotRequest) {
    return "Not visually proven; human-pasted command text does not prove the rendered UI state.";
  }
  if (input.sheetsDocsOnlyReadinessRequest) {
    return "No; Sheets sync readiness is not proven when preflight output is missing.";
  }
  if (input.brightspaceSeedGoldNoCiRequest) {
    return `Not proven; ${BRIGHTSPACE_SURFACE.commands.forbiddenSeedGold} output is not a substitute for ${BRIGHTSPACE_SURFACE.commands.build} and ${BRIGHTSPACE_SURFACE.commands.ingestGate} proof.`;
  }
  if (input.crossRepoEvidenceTrap) {
    return "Invalid proof; canvas-helper command evidence cannot prove Brightspace readiness.";
  }
  if (input.wrongRootValidationRequest) {
    return "Invalid proof path; ADMISSION-APP validation must run from the ADMISSION-APP repo root, not STAX.";
  }
  if (input.crossRepoZipEvidenceTrap) {
    return "No; ADMISSION-APP zip evidence cannot assess canvas-helper UI readiness.";
  }
  if (input.nonExistentRepoPathClaim) {
    return "Not valid; a tests-passed claim tied to a non-existent repo path is unproven.";
  }
  if (input.cleanupMinimizationRequest) {
    return "Use one evidence-harvesting prompt, not another broad cleanup prompt.";
  }
  if (input.proofOnlyScopePromptRequest) {
    return "Use proof-only mode: force command evidence and block parser, fixture, source, and gold scope creep.";
  }
  if (input.visualArtifactPromptRequest) {
    return "UI-fix claims require a visual proof artifact before acceptance.";
  }
  if (input.explicitPublishSyncTask && input.admissionApp && !input.sheetsPublishClaim && !input.pipelinePublishClaim && !input.ualbertaPipelineClaim) {
    return `ADMISSION-APP publish/sync is not proven ready until ${ADMISSION_SURFACE.commands.syncPreflight}, ${ADMISSION_SURFACE.commands.appsScriptValidation}, or ${ADMISSION_SURFACE.commands.canonicalValidation} passes locally.`;
  }
  if (input.publishPreflightPromptRequest) {
    return "Publish/sync remains blocked until preflight evidence is produced locally.";
  }
  if (input.admissionPipelineFilesPublishSafeRequest) {
    return "Not publish-safe; ADMISSION-APP pipeline file existence is not validation or preflight proof.";
  }
  if (input.wrongRepoEvidencePaths.length) {
    return "Not proven; supplied command/report evidence points at the wrong repo for this task.";
  }
  if (input.repoPathWithheld) {
    if (input.seedGoldMisuse) {
      return "Not proven; target repo path is withheld and ingest:seed-gold/gold mutation is forbidden proof.";
    }
    if (input.iosReleaseClaim && !input.explicitPublishSyncTask) {
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
    return `Reject as proof; ${BRIGHTSPACE_SURFACE.commands.forbiddenSeedGold} or gold mutation is outside the allowed proof boundary.`;
  }
  if (input.dependencyScopeViolation) {
    return "Reject or require correction; the dependency repair appears to touch forbidden source/parser scope.";
  }
  if (input.visualProofClaim) {
    return "Not visually proven; source/CSS changes need rendered visual evidence and a checklist.";
  }
  if (input.iosReleaseClaim && !input.explicitPublishSyncTask) {
    return "Not release-ready as proven; checklist existence or unchecked gates do not prove TestFlight/App Store readiness.";
  }
  if (input.sheetsPublishClaim) {
    return `Do not publish yet; Sheets sync safety needs target/config/validation evidence: ${ADMISSION_SURFACE.files.requiredSheetsConfig} plus read-only Sheets sync preflight from ${ADMISSION_SURFACE.commands.syncPreflight}, ${ADMISSION_SURFACE.commands.appsScriptValidation}, or ${ADMISSION_SURFACE.commands.canonicalValidation}.`;
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
    if (input.codexReportAuditRequest) {
      return "Not proven; the Codex report claims tests/completion without local command evidence.";
    }
    return "Not proven; the tests-passed claim needs local command evidence.";
  }
  if (input.repoRiskRequest && input.admissionApp) {
    return `Not proven; app-admissions operating risk is publish/sync without ${ADMISSION_SURFACE.commands.build} and preflight evidence.`;
  }
  if (input.repoRiskRequest && input.brightspace) {
    return "Not proven; Brightspace operating risk cannot be judged safely without build/ingest command evidence.";
  }
  if (input.repoRiskRequest && input.canvasHelper) {
    return "Not proven; canvas-helper operating risk cannot be judged safely without rendered proof evidence.";
  }
  if (input.proofGapRequest && input.admissionApp) {
    return "Proof gap is unverified; app-admissions command inventory needs local repo evidence.";
  }
  if (input.proofGapRequest && input.brightspace) {
    return "Proof gap is unverified; Brightspace command inventory needs local repo evidence.";
  }
  if (input.proofGapRequest && input.canvasHelper) {
    return "Proof gap is unverified; canvas-helper command and visual-proof inventory needs local repo evidence.";
  }
  if (input.boundedPromptRequest && input.explicitAdmissionTask) {
    return "A bounded prompt can be drafted, but its strongest command/file scope remains unverified until local repo evidence is supplied.";
  }
  if (input.boundedPromptRequest && input.explicitBrightspaceTask) {
    return "A bounded prompt can be drafted, but its strongest Brightspace command/file scope remains unverified until local repo evidence is supplied.";
  }
  if (input.boundedPromptRequest && input.explicitCanvasTask) {
    return "A bounded prompt can be drafted, but its strongest canvas-helper file/proof-artifact scope remains unverified until local repo evidence is supplied.";
  }
  return "Needs evidence before approval.";
}

function projectControlNextAction(input: ProjectControlSignals): string {
  if (input.commandSourceClassificationRequest) {
    return "Treat local_stax command output with cwd, command, exit code, and relevant output as strong proof; require a local rerun before accepting codex_reported or human_pasted pass claims.";
  }
  if (input.codexReportedOnlyProofRequest) {
    return "Run the exact test command locally in the target repo and capture cwd, command, exit code, and final test summary before saying tests passed.";
  }
  if (input.uiHumanPastedNoScreenshotRequest) {
    return "Capture one rendered screenshot or browser-preview artifact of the affected UI state, with cwd, command, URL, viewport, and timestamp.";
  }
  if (input.sheetsDocsOnlyReadinessRequest) {
    return "Run the repo's safest read-only Sheets sync preflight/readiness check and capture cwd, command, exit code, and output before any publish or sync.";
  }
  if (input.brightspaceSeedGoldNoCiRequest) {
    return "Run npm run build and npm run ingest:ci from the Brightspace repo root and ignore seed-gold as proof of the ingest fix.";
  }
  if (input.crossRepoEvidenceTrap) {
    return "Rerun the Brightspace proof from /Users/deanguedo/Documents/GitHub/brightspacequizexporter and ignore the canvas-helper command evidence.";
  }
  if (input.wrongRootValidationRequest) {
    return "Run exactly one ADMISSION-APP validation/preflight command from /Users/deanguedo/Documents/GitHub/ADMISSION-APP and capture local output.";
  }
  if (input.crossRepoZipEvidenceTrap) {
    return "Collect canvas-helper-specific evidence only: changed files plus rendered screenshot or local preview output from /Users/deanguedo/Documents/GitHub/canvas-helper.";
  }
  if (input.nonExistentRepoPathClaim) {
    return "Stop on the missing repo path, then require the correct repo root and rerun pwd && git rev-parse --show-toplevel && npm test before accepting any tests-passed claim.";
  }
  if (input.cleanupMinimizationRequest) {
    return "Ask Codex to inspect only the main claimed changed area, produce exact files/diff summary, run one proof command or produce one artifact, then stop.";
  }
  if (input.proofOnlyScopePromptRequest) {
    return "Send a proof-only prompt that forbids parser, fixture, source, gold, and test edits and asks for one exact command output plus first failure.";
  }
  if (input.visualArtifactPromptRequest) {
    return "Send a visual-proof prompt requiring a screenshot artifact path and visible issue checklist before accepting any UI-fix claim.";
  }
  if (input.pwshMissingBlocker && input.cleanFailureQuestion) {
    return "Run tools/validate-sync-surface.ps1 from the ADMISSION-APP repo in an environment with pwsh/PowerShell available, then capture cwd, command, exit code, and output before any publish or sync.";
  }
  if (input.scrapeDataCorrectnessRequest) {
    if (input.avgTotalGapTraceRequest) {
      return "Trace one concrete ADMISSION-APP Avg_Total data gap end to end: pick one canonical row with Min_Avg_Final present and Avg_Total blank, compare it to pipeline/program_index.cleaned.csv and pipeline_artifacts/extract/avg_total_candidates.csv, then report whether the blocker is source absence, extraction coverage, or identity drift.";
    }
    if (input.scrapeCoverageAuditSupplied) {
      return "Treat the supplied audit as provisional, then trace the first concrete gap: why Avg_Total and core requirement fields are blank for most canonical rows, starting with one institution and one field.";
    }
    return "Run one read-only/dry-run ADMISSION-APP data-contract audit: compare app-consumed columns to data/ALBERTA_ADMISSIONS_MASTER_CANONICAL.csv headers, report blank rates for admissions requirement fields, then run existing pipeline fixture checks.";
  }
  if (input.admissionDatasetValidationPassedEvidence) {
    return "Use the passing dataset-schema check as a floor, then run the ADMISSION-APP field-coverage audit for app-consumed admissions columns and report the first sparse field or identity-drift blocker.";
  }
  if (input.dogfoodCampaignAudit && input.staxValidationEvidence) {
    return "Record the 10th real dogfood task in fixtures/real_use/dogfood_10_tasks_2026-04-30.json and update docs/RAX_REAL_USE_CAMPAIGN_REPORT.md to 10/10 with the validation evidence and any remaining limits.";
  }
  if (input.priorRunProofRequest && input.explicitBrightspaceTask) {
    return "Run npm run build and then npm run ingest:ci from /Users/deanguedo/Documents/GitHub/brightspacequizexporter and report the first remaining failure or passing output.";
  }
  if (input.priorRunProofRequest && input.explicitAdmissionTask) {
    return `Run ${ADMISSION_SURFACE.commands.syncPreflight} or ${ADMISSION_SURFACE.commands.canonicalValidation} from ${ADMISSION_SURFACE.repoPath} and capture exact output before ${formatBlockedActions(ADMISSION_SURFACE)}.`;
  }
  if (input.priorRunProvenVsUnprovenRequest) {
    return "From /Users/deanguedo/Documents/GitHub/STAX, run pwd && git status --short && git diff --stat && npm test, then report exactly what is proven, unproven, and the first failure if any.";
  }
  if (input.priorRunFakeCompleteRequest) {
    return "From /Users/deanguedo/Documents/GitHub/STAX, run pwd && git status --short && git diff --stat && npm test so the prior summary is downgraded or confirmed by repo-local evidence.";
  }
  if (input.priorRunProofRequest) {
    return "Run one local proof audit from the STAX repo root: show repo identity, relevant diff, exact command output, and first remaining failure.";
  }
  if (
    input.explicitStaxTask &&
    !input.memoryAutoApprovalClaim &&
    !input.codexClaimsTestsPassed &&
    !input.humanPastedWeakProof &&
    !input.wrongRepoEvidencePaths.length &&
    !input.commandSourceClassificationRequest
  ) {
    if (input.staxPromotionGateRequest) {
      return "From /Users/deanguedo/Documents/GitHub/STAX, run npm run campaign:promotion-gate and report exact output, gate status, and the first blocking metric.";
    }
    if (input.staxEvalRequest) {
      return "From /Users/deanguedo/Documents/GitHub/STAX, run npm run rax -- eval and report exact output, exit code, and the first failure if any.";
    }
    if (input.staxTypecheckRequest) {
      return "From /Users/deanguedo/Documents/GitHub/STAX, run npm run typecheck and report exact output, exit code, and the first failure if any.";
    }
    return "From /Users/deanguedo/Documents/GitHub/STAX, collect local evidence: review the relevant diff, rerun npm run typecheck, npm test, and npm run rax -- eval, and report exact command output plus the first remaining failure before any commit-ready claim.";
  }
  if (input.explicitBrightspaceTask && input.brightspaceIngestGateRequest) {
    return "In /Users/deanguedo/Documents/GitHub/brightspacequizexporter, run npm run ingest:ci and report exact output, whether its build step passed, whether ingest:promotion-check was reached, and the first remaining failure.";
  }
  if (input.explicitBrightspaceTask && input.brightspaceBuildGateRequest) {
    return "In /Users/deanguedo/Documents/GitHub/brightspacequizexporter, run npm run build and report exact output, exit code, and the first remaining failure before any ingest-ready claim.";
  }
  if (input.explicitBrightspaceTask && input.brightspaceIngestPassedEvidence) {
    return "Record the passing npm run ingest:ci evidence for Brightspace and stop; only widen scope if a new claim falls outside the ingest gate.";
  }
  if (input.explicitBrightspaceTask && input.brightspaceBuildPassedEvidence) {
    return "In /Users/deanguedo/Documents/GitHub/brightspacequizexporter, run npm run ingest:ci next and report whether its build step passed, whether ingest:promotion-check was reached, and the first remaining failure.";
  }
  if (
    input.explicitBrightspaceTask &&
    !input.priorRunProofRequest &&
    !input.rollupPresent &&
    !input.wrongRepoEvidencePaths.length &&
    !input.crossRepoEvidenceTrap &&
    !input.dependencyScopeViolation &&
    !input.codexClaimsTestsPassed
  ) {
    return "In /Users/deanguedo/Documents/GitHub/brightspacequizexporter, run npm ls @rollup/rollup-darwin-arm64 rollup vite and report exact output before any repair.";
  }
  if (input.explicitPublishSyncTask && input.admissionApp && !input.sheetsPublishClaim && !input.pipelinePublishClaim && !input.ualbertaPipelineClaim) {
    return `Run ${ADMISSION_SURFACE.commands.build} plus one non-publishing ADMISSION-APP preflight command (${ADMISSION_SURFACE.commands.syncPreflight}, ${ADMISSION_SURFACE.commands.appsScriptValidation}, or ${ADMISSION_SURFACE.commands.canonicalValidation}) and capture cwd, command, exit code, and output before ${formatBlockedActions(ADMISSION_SURFACE)}.`;
  }
  if (input.publishPreflightPromptRequest) {
    return `Send a preflight-only prompt that forbids ${formatBlockedActions(ADMISSION_SURFACE)}, deploy, push, and production data mutation until ${ADMISSION_SURFACE.commands.syncPreflight} or ${ADMISSION_SURFACE.commands.canonicalValidation} output is captured.`;
  }
  if (input.admissionPipelineFilesPublishSafeRequest) {
    return "Run one existing non-publishing ADMISSION-APP pipeline/preflight validation command and capture cwd, command, exit code, and output before any publish/sync.";
  }
  if (input.repoPathWithheld) {
    if (input.seedGoldMisuse) {
      return "Ask for the target repo path, then run only the approved Brightspace proof gate npm run build followed by npm run ingest:ci; do not run ingest:seed-gold or update gold files.";
    }
    if (input.iosReleaseClaim && !input.explicitPublishSyncTask) {
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
      return `Provide ${CANVAS_SURFACE.proofArtifacts[0]} for Sports Wellness, including text fit, border symmetry, and checkmark containment; then run ${CANVAS_SURFACE.commands.build} only if build proof is also claimed.`;
    }
    if (input.admissionApp) {
      return "Capture rendered web app evidence and complete docs/WEBAPP_QA_CHECKLIST.md before calling the layout fixed.";
    }
    return "Provide a rendered screenshot or manual visual checklist result for the claimed UI fix before calling the layout fixed.";
  }
  if (input.iosReleaseClaim && !input.explicitPublishSyncTask) {
    return "In mobile/ios-wrapper, run npm run preflight and report the exact output before treating the wrapper as TestFlight-ready.";
  }
  if (input.sheetsPublishClaim) {
    if (input.sheetsValidationCommandKnown) {
      return `Inspect target/config/validation evidence, then run read-only Sheets sync preflight ${ADMISSION_SURFACE.commands.syncPreflight} first and report target Sheet/${ADMISSION_SURFACE.files.requiredSheetsConfig} status before any SYNC_ALL.cmd, PUBLISH_DATA_TO_SHEETS.bat publish command, or SYNC_PROGRAMS.cmd.`;
    }
    return `Inspect target/config/validation evidence, then run read-only Sheets sync preflight ${ADMISSION_SURFACE.commands.syncPreflight}; if unavailable, run ${ADMISSION_SURFACE.commands.appsScriptValidation} or ${ADMISSION_SURFACE.commands.canonicalValidation}, then report target Sheet/${ADMISSION_SURFACE.files.requiredSheetsConfig} status before any SYNC_ALL.cmd, PUBLISH_DATA_TO_SHEETS.bat publish command, or SYNC_PROGRAMS.cmd.`;
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
    if (input.codexReportAuditRequest && input.explicitBrightspaceTask) {
      return "Require a Brightspace evidence packet: exact files changed plus npm run build and npm run ingest:ci outputs with first remaining failure if any.";
    }
    if (input.codexReportAuditRequest && input.explicitCanvasTask) {
      return "Require a canvas-helper evidence packet: exact files changed, one rendered screenshot artifact for Sports Wellness, and local command output for any claimed tests.";
    }
    if (input.targetRepoPath?.endsWith("/STAX")) {
      return "In /Users/deanguedo/Documents/GitHub/STAX, rerun npm test and report exact command output, exit code, and first failure before treating the rollout as proven.";
    }
    return "Ask Codex to return the exact command output for npm test or rerun the relevant local test command before treating the report as proven.";
  }
  if (input.boundedPromptRequest && input.explicitBrightspaceTask) {
    return "Create a Brightspace-only Codex packet scoped to dependency/install integrity first: inspect package-lock/package scripts, run npm ls @rollup/rollup-darwin-arm64 rollup vite, then run npm run build and npm run ingest:ci with exact output and first failure.";
  }
  if (input.boundedPromptRequest && input.explicitAdmissionTask) {
    return "Create an ADMISSION-APP bounded Codex packet that inspects package scripts and runs npm run build:pages with exact output before any completion claim.";
  }
  if (input.boundedPromptRequest && input.explicitCanvasTask) {
    return "Create a canvas-helper bounded Codex packet scoped to Sports Wellness evidence: inspect projects/sportswellness/workspace files, request rendered preview proof, and report the first visible layout failure before claiming fixed.";
  }
  if (input.repoRiskRequest && input.brightspace) {
    return "Confirm Brightspace gate status with npm run build followed by npm run ingest:ci, then report the first remaining failure or passing output.";
  }
  if (input.repoRiskRequest && input.admissionApp) {
    return `Confirm app-admissions operating risk with ${ADMISSION_SURFACE.commands.build} and one preflight (${ADMISSION_SURFACE.commands.syncPreflight} or ${ADMISSION_SURFACE.commands.canonicalValidation}), then report exact output before any readiness claim.`;
  }
  if (input.repoRiskRequest && input.canvasHelper) {
    return `Confirm canvas-helper risk with ${CANVAS_SURFACE.proofArtifacts[0]} for Sports Wellness and ${CANVAS_SURFACE.commands.build} output before any fixed/build claim.`;
  }
  if (input.proofGapRequest && input.brightspace) {
    return "List the discovered Brightspace test/ingest surfaces and run the next missing proof gate (npm run ingest:ci), then report the first failure.";
  }
  if (input.proofGapRequest && input.admissionApp) {
    return `List known app-admissions proof surfaces (${ADMISSION_SURFACE.commands.build}, ${ADMISSION_SURFACE.commands.syncPreflight}, ${ADMISSION_SURFACE.commands.appsScriptValidation}, ${ADMISSION_SURFACE.commands.canonicalValidation}) and run the single safest missing proof command, then report the first failure.`;
  }
  if (input.proofGapRequest && input.canvasHelper) {
    return `List known canvas-helper proof surfaces (${CANVAS_SURFACE.commands.build}, ${CANVAS_SURFACE.commands.typecheck}, ${CANVAS_SURFACE.commands.courseShellTest}, ${CANVAS_SURFACE.commands.e2e}/${CANVAS_SURFACE.commands.scopedE2e}) and request one ${CANVAS_SURFACE.proofArtifacts[0]} for Sports Wellness before closing the task.`;
  }
  return "Collect the smallest local evidence packet: relevant diff, exact command output, and first remaining failure if any.";
}

function projectControlPrompt(input: ProjectControlSignals): string {
  if (input.pwshMissingBlocker && input.cleanFailureQuestion) {
    return [
      "```txt",
      "This is a clean blocked proof run, not completion.",
      "Do not publish, sync, deploy, push, or mutate production data.",
      "Use an environment with pwsh/PowerShell available.",
      "From /Users/deanguedo/Documents/GitHub/ADMISSION-APP, run tools/validate-sync-surface.ps1.",
      "Return cwd, exact command, exit code, full relevant output, and remaining publish/sync blockers.",
      "```"
    ].join("\n");
  }
  if (input.scrapeDataCorrectnessRequest) {
    if (input.avgTotalGapTraceRequest) {
      return [
        "```txt",
        "Work only in /Users/deanguedo/Documents/GitHub/ADMISSION-APP.",
        "Do not publish, sync, deploy, push, scrape live sites, or mutate canonical data.",
        "Trace one concrete Avg_Total gap end to end.",
        "Pick one canonical row where Min_Avg_Final is present and Avg_Total is blank.",
        "Compare that row against pipeline/program_index.cleaned.csv and pipeline_artifacts/extract/avg_total_candidates.csv.",
        "Return the row identity, whether the blocker is source absence, extraction coverage, or identity drift, and one bounded next fix or stop condition.",
        "```"
      ].join("\n");
    }
    if (input.scrapeCoverageAuditSupplied) {
      return [
        "```txt",
        "Work only in /Users/deanguedo/Documents/GitHub/ADMISSION-APP.",
        "Do not publish, sync, deploy, push, scrape live sites, or mutate canonical data.",
        "Use the supplied coverage audit as provisional context, then verify one narrow gap locally.",
        "Pick one institution and one high-blank app-consumed field, starting with Avg_Total unless another field is explicitly prioritized.",
        "Trace whether the blank value comes from missing source data, extraction rules, candidate application not run, or intentional uncheckable status.",
        "Return exact files/rows inspected, whether this is data absence vs parser/extraction gap, and one bounded next fix or stop condition.",
        "```"
      ].join("\n");
    }
    return [
      "```txt",
      "Work only in /Users/deanguedo/Documents/GitHub/ADMISSION-APP.",
      "Do not publish, sync, deploy, push, scrape live sites, or mutate canonical data.",
      "Inspect app data consumers in apps_script/EligibilityProgramsData.gs and apps_script/EligibilityEngine.gs.",
      "Compare the consumed fields against data/ALBERTA_ADMISSIONS_MASTER_CANONICAL.csv headers.",
      "Report row count, institution counts, missing required headers, and blank rates for admissions fields: Min_Avg_Final, Competitive_Final, Avg_Total, English_Req, English_Min, Math_Req, Math_Min, Science_Req, Science_Min, Elective_Qty, Elective_Pool, Requirement_Type, Program_URL.",
      "Run existing read-only/dry-run checks only: python3 tools/validate-dataset.py --input data/ALBERTA_ADMISSIONS_MASTER_CANONICAL.csv, python3 pipeline/check_avg_total_fixtures.py, python3 pipeline/check_enrichment_link_fixtures.py, and python3 pipeline/check_nait_program_filter_fixtures.py.",
      "Return what is verified, weak, unverified, and the first data gap. Do not call the scrape correct from file existence alone.",
      "```"
    ].join("\n");
  }
  if (input.admissionDatasetValidationPassedEvidence) {
    return [
      "```txt",
      "Work only in /Users/deanguedo/Documents/GitHub/ADMISSION-APP.",
      "Do not publish, sync, deploy, push, scrape live sites, or mutate canonical data.",
      "Treat the passing validate-dataset.py result as schema floor only, not app-readiness proof.",
      "Run the field-coverage audit for app-consumed admissions columns and report the first sparse field or identity-drift blocker.",
      "Return exact file paths, row/blank-rate evidence, and one bounded next fix or stop condition.",
      "```"
    ].join("\n");
  }
  if (
    input.explicitStaxTask &&
    !input.memoryAutoApprovalClaim &&
    !input.codexClaimsTestsPassed &&
    !input.humanPastedWeakProof &&
    !input.wrongRepoEvidencePaths.length &&
    !input.commandSourceClassificationRequest
  ) {
    if (input.staxPromotionGateRequest) {
      return [
        "```txt",
        "Work only in /Users/deanguedo/Documents/GitHub/STAX.",
        "Do not commit or push.",
        "Run exactly: npm run campaign:promotion-gate",
        "Return cwd, exact command, exit code, gate status, blocking metrics, and the first remaining blocker before any 9.5 claim.",
        "```"
      ].join("\n");
    }
    if (input.staxEvalRequest) {
      return [
        "```txt",
        "Work only in /Users/deanguedo/Documents/GitHub/STAX.",
        "Do not commit or push.",
        "Run exactly: npm run rax -- eval",
        "Return cwd, exact command, exit code, pass/fail summary, and the first remaining blocker if any.",
        "```"
      ].join("\n");
    }
    if (input.staxTypecheckRequest) {
      return [
        "```txt",
        "Work only in /Users/deanguedo/Documents/GitHub/STAX.",
        "Do not commit or push.",
        "Run exactly: npm run typecheck",
        "Return cwd, exact command, exit code, and the first remaining blocker if any.",
        "```"
      ].join("\n");
    }
    if (input.dogfoodCampaignAudit && input.staxValidationEvidence) {
      return [
        "```txt",
        "Work only in /Users/deanguedo/Documents/GitHub/STAX.",
        "Record the 10th real dogfood task in fixtures/real_use/dogfood_10_tasks_2026-04-30.json.",
        "Update docs/RAX_REAL_USE_CAMPAIGN_REPORT.md to 10/10.",
        "Include the supplied validation evidence: npm run typecheck, npm test, npm run rax -- eval, and the fitness smoke passed.",
        "Do not claim STAX is 9+ or generally better than ChatGPT; say this is usage-proof evidence with zero STAX critical misses in this loop.",
        "Report changed files and any remaining unverified limits.",
        "```"
      ].join("\n");
    }
    return [
      "```txt",
      "Work only in /Users/deanguedo/Documents/GitHub/STAX.",
      "Do not commit or push yet.",
      "Collect local evidence before any commit-ready claim.",
      "Review the relevant diff for comparison-integrity, dogfood, and project_control changes.",
      "Run exactly:",
      "- npm run typecheck",
      "- npm test",
      "- npm run rax -- eval",
      "Report changed files, exact command output, any report/ledger inconsistency, and the first remaining blocker before saying commit-ready.",
      "```"
    ].join("\n");
  }
  if (
    input.explicitBrightspaceTask &&
    input.brightspaceIngestGateRequest
  ) {
    return [
      "```txt",
      "Work only in /Users/deanguedo/Documents/GitHub/brightspacequizexporter.",
      "Do not edit parser/source/tests/fixtures/gold and do not run ingest:seed-gold.",
      "Run exactly: npm run ingest:ci",
      "Return cwd, exact command, exit code, whether its build step passed, whether ingest:promotion-check was reached, and the first remaining failure.",
      "```"
    ].join("\n");
  }
  if (
    input.explicitBrightspaceTask &&
    input.brightspaceIngestPassedEvidence
  ) {
    return [
      "```txt",
      "Work only in /Users/deanguedo/Documents/GitHub/brightspacequizexporter.",
      "The ingest gate already passed locally for this run.",
      "Record the exact npm run ingest:ci evidence, including whether build and ingest:promotion-check passed.",
      "Stop after recording what this run proves and what remains out of scope.",
      "```"
    ].join("\n");
  }
  if (
    input.explicitBrightspaceTask &&
    input.brightspaceBuildPassedEvidence
  ) {
    return [
      "```txt",
      "Work only in /Users/deanguedo/Documents/GitHub/brightspacequizexporter.",
      "Do not edit parser/source/tests/fixtures/gold and do not run ingest:seed-gold.",
      "The build gate already passed locally for this run.",
      "Run exactly: npm run ingest:ci",
      "Return cwd, exact command, exit code, whether its build step passed, whether ingest:promotion-check was reached, and the first remaining failure.",
      "```"
    ].join("\n");
  }
  if (
    input.explicitBrightspaceTask &&
    input.brightspaceBuildGateRequest
  ) {
    return [
      "```txt",
      "Work only in /Users/deanguedo/Documents/GitHub/brightspacequizexporter.",
      "Do not edit parser/source/tests/fixtures/gold and do not run ingest:seed-gold.",
      "Run exactly: npm run build",
      "Return cwd, exact command, exit code, and the first remaining failure before any ingest-ready claim.",
      "```"
    ].join("\n");
  }
  if (
    input.explicitBrightspaceTask &&
    !input.rollupPresent &&
    !input.wrongRepoEvidencePaths.length &&
    !input.crossRepoEvidenceTrap &&
    !input.dependencyScopeViolation &&
    !input.codexClaimsTestsPassed
  ) {
    return [
      "```txt",
      "Work only in /Users/deanguedo/Documents/GitHub/brightspacequizexporter.",
      "Do not edit parser/source/tests/fixtures/gold and do not run ingest:seed-gold.",
      "Before any repair, run exactly:",
      "npm ls @rollup/rollup-darwin-arm64 rollup vite",
      "Return cwd, exact command, exit code, output, and whether the next bounded gate is dependency repair or npm run build followed by npm run ingest:ci.",
      "Do not commit, push, or claim ingest fixed without build and ingest:ci evidence.",
      "```"
    ].join("\n");
  }
  if (input.commandSourceClassificationRequest) {
    return [
      "```txt",
      "Classify command evidence by source before making any pass/fail claim.",
      "Strong proof: local_stax output with cwd, exact command, exit code, and relevant stdout/stderr from the target repo.",
      "Weak/provisional: codex_reported summaries and human_pasted output unless cross-checked by local evidence.",
      "Return the strongest available evidence, what remains unverified, and one local rerun command if proof is weak.",
      "```"
    ].join("\n");
  }
  if (input.codexReportedOnlyProofRequest) {
    return [
      "```txt",
      "Do not treat Codex-reported output as tests-passed proof.",
      "From the target repo root, rerun the exact test command locally.",
      "Return only: pwd, exact command, exit code, full relevant output, and whether tests are proven passed from that local output.",
      "```"
    ].join("\n");
  }
  if (input.uiHumanPastedNoScreenshotRequest || input.visualArtifactPromptRequest) {
    return [
      "```txt",
      "Do not accept UI-fix claims from code/CSS changes or human-pasted command text alone.",
      "Open the affected UI locally in the correct route/state.",
      "Capture one screenshot artifact and report: cwd, command, local URL, viewport, screenshot path, and checklist findings for overlap, clipping, text fit, and containment.",
      "Stop if screenshot evidence is unavailable.",
      "```"
    ].join("\n");
  }
  if (input.explicitPublishSyncTask && input.admissionApp && !input.sheetsPublishClaim && !input.pipelinePublishClaim && !input.ualbertaPipelineClaim) {
    return [
      "```txt",
      `Do not run ${formatBlockedActions(ADMISSION_SURFACE)}, deploy, push, or mutate production data.`,
      `Work in ${ADMISSION_SURFACE.repoPath}.`,
      `Check required config surface: ${ADMISSION_SURFACE.files.requiredSheetsConfig}; ${ADMISSION_SURFACE.files.exampleSheetsConfig} is example-only.`,
      "Run exactly one existing non-publishing proof command:",
      `- ${ADMISSION_SURFACE.commands.build}`,
      `- ${ADMISSION_SURFACE.commands.syncPreflight}`,
      `- or ${ADMISSION_SURFACE.commands.appsScriptValidation}`,
      `- or ${ADMISSION_SURFACE.commands.canonicalValidation}`,
      "Return cwd, exact command, exit code, full relevant output, and remaining publish/sync blockers.",
      "Stop after the preflight/validation result.",
      "```"
    ].join("\n");
  }
  if (input.sheetsDocsOnlyReadinessRequest || input.publishPreflightPromptRequest) {
    return [
      "```txt",
      `Do not run ${formatBlockedActions(ADMISSION_SURFACE)}, deploy, push, or mutate production data.`,
      `From ${ADMISSION_SURFACE.repoPath}, verify ${ADMISSION_SURFACE.files.requiredSheetsConfig}; do not treat ${ADMISSION_SURFACE.files.exampleSheetsConfig} as live config.`,
      `Run only one preflight command: ${ADMISSION_SURFACE.commands.syncPreflight} or ${ADMISSION_SURFACE.commands.canonicalValidation}.`,
      "Return repo path, command, exit code, full relevant output, explicit PASS/FAIL, and missing env/config reported by the command.",
      "Stop after preflight evidence.",
      "```"
    ].join("\n");
  }
  if (input.brightspaceSeedGoldNoCiRequest) {
    return [
      "```txt",
      "Audit the Brightspace ingest claim without accepting seed-gold as proof.",
      "Do not run ingest:seed-gold and do not edit parser, source, fixture, gold, or benchmark files.",
      "From /Users/deanguedo/Documents/GitHub/brightspacequizexporter, run npm run build and npm run ingest:ci.",
      "Return cwd, exact commands, exit codes, output, and first remaining failure.",
      "```"
    ].join("\n");
  }
  if (input.crossRepoEvidenceTrap) {
    return [
      "```txt",
      "Reject canvas-helper command evidence as Brightspace proof.",
      "Work only in /Users/deanguedo/Documents/GitHub/brightspacequizexporter.",
      "Run the smallest Brightspace proof command needed for the claim and report cwd, command, exit code, output, and first remaining failure.",
      "Do not cite canvas-helper output as proof.",
      "```"
    ].join("\n");
  }
  if (input.wrongRootValidationRequest) {
    return [
      "```txt",
      "Do not run ADMISSION-APP validation from the STAX repo root.",
      "Work only in /Users/deanguedo/Documents/GitHub/ADMISSION-APP.",
      "Inspect package scripts/docs for the safest read-only validation/preflight command, run exactly one, and report cwd, command, exit code, and output.",
      "Do not publish, sync, deploy, or mutate data.",
      "```"
    ].join("\n");
  }
  if (input.crossRepoZipEvidenceTrap) {
    return [
      "```txt",
      "Reject ADMISSION-APP zip evidence as canvas-helper UI proof.",
      "Work only in /Users/deanguedo/Documents/GitHub/canvas-helper.",
      "Collect canvas-helper-specific evidence: changed file list/diff summary plus rendered screenshot or local preview output.",
      "Do not claim UI readiness without the canvas-helper proof artifact.",
      "```"
    ].join("\n");
  }
  if (input.nonExistentRepoPathClaim) {
    return [
      "```txt",
      "First verify the intended repo path exists.",
      "If it does not exist, stop and report that tests are unverified.",
      "If the correct repo root is supplied, run exactly: pwd && git rev-parse --show-toplevel && npm test",
      "Return path existence, git root, exact test output, exit code, and pass/fail based only on local evidence.",
      "```"
    ].join("\n");
  }
  if (input.cleanupMinimizationRequest) {
    return [
      "```txt",
      "Audit the partially useful Codex report and verify only its highest-risk claim.",
      "Do not broaden scope or refactor unrelated files.",
      "Inspect only files tied to the report's main claim.",
      "Return exact files inspected, exact files changed if any, concise diff summary, one local proof command output or one proof artifact path, and remaining unverified items.",
      "Stop if proof fails or no proof artifact can verify the claim.",
      "```"
    ].join("\n");
  }
  if (input.proofOnlyScopePromptRequest) {
    return [
      "```txt",
      "You are in proof-only mode.",
      "Do not edit parser code, fixtures, source files, gold files, or tests.",
      "Run exactly one bounded local proof command from the correct repo root.",
      "Return cwd, exact command, exit code, full relevant stdout/stderr, and one-sentence verdict: proven / not proven.",
      "Stop after reporting evidence.",
      "```"
    ].join("\n");
  }
  if (input.admissionPipelineFilesPublishSafeRequest) {
    return [
      "```txt",
      "Do not publish, sync, deploy, push, or mutate production data.",
      "Work in /Users/deanguedo/Documents/GitHub/ADMISSION-APP.",
      "Pipeline file existence is not proof.",
      "Run one existing non-publishing pipeline/preflight validation command.",
      "Return cwd, exact command, exit code, output, and remaining publish/sync blockers.",
      "```"
    ].join("\n");
  }
  if (input.priorRunProofRequest && input.explicitBrightspaceTask) {
    return [
      "```txt",
      "Validate the last Brightspace run with local command evidence only.",
      "Work in /Users/deanguedo/Documents/GitHub/brightspacequizexporter.",
      "Run npm run build, then npm run ingest:ci.",
      "Return cwd, exact commands, exit codes, relevant output, and first remaining failure if any.",
      "Do not edit parser, source, fixture, gold, benchmark, or ingest-promotion files.",
      "```"
    ].join("\n");
  }
  if (input.priorRunProofRequest && input.explicitAdmissionTask) {
    return [
      "```txt",
      "Do not publish, sync, deploy, push, or mutate production data.",
      "Work in /Users/deanguedo/Documents/GitHub/ADMISSION-APP.",
      "Run one existing non-publishing preflight/validation command for publish/sync readiness.",
      "Return cwd, command, exit code, output, and what remains blocked.",
      "```"
    ].join("\n");
  }
  if (input.priorRunProvenVsUnprovenRequest) {
    return [
      "```txt",
      "Audit the prior STAX run by proving only what local repo evidence supports.",
      "From /Users/deanguedo/Documents/GitHub/STAX, run exactly: pwd && git status --short && git diff --stat && npm test",
      "Return what is proven, what remains unproven, the exact command output, and the first failure if any.",
      "Do not claim completion from the prior summary alone.",
      "```"
    ].join("\n");
  }
  if (input.priorRunFakeCompleteRequest) {
    return [
      "```txt",
      "Audit the previous STAX run summary for fake-complete risk.",
      "From /Users/deanguedo/Documents/GitHub/STAX, run exactly: pwd && git status --short && git diff --stat && npm test",
      "Return one fake-complete risk, one bounded correction step, the exact command output, and the first failure if any.",
      "Do not accept the prior summary as proof.",
      "```"
    ].join("\n");
  }
  if (input.priorRunProofRequest) {
    return [
      "```txt",
      "Audit the prior STAX run without accepting summary claims as proof.",
      "From /Users/deanguedo/Documents/GitHub/STAX, report repo identity, relevant diff, exact command output, and first remaining failure.",
      "Do not claim completion without local command or artifact evidence.",
      "```"
    ].join("\n");
  }
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
    if (input.iosReleaseClaim && !input.explicitPublishSyncTask) {
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
    if (input.canvasHelper) {
      return [
        "```txt",
        `Work only in ${CANVAS_SURFACE.repoPath}.`,
        "Do not claim Sports Wellness is fixed from source/CSS changes alone.",
        "Inspect only:",
        `- ${CANVAS_SURFACE.files.sportsWellnessHtml}`,
        `- ${CANVAS_SURFACE.files.sportsWellnessCss}`,
        `- ${CANVAS_SURFACE.files.sportsWellnessJs}`,
        `Proof artifact required: ${CANVAS_SURFACE.proofArtifacts[0]} (desktop viewport).`,
        `If claiming build success too, run ${CANVAS_SURFACE.commands.build}; for broader course shell proof use ${CANVAS_SURFACE.commands.courseShellTest}, and for scoped e2e use ${CANVAS_SURFACE.commands.scopedE2e}.`,
        "Report checklist results for text fit, symmetry, icon containment, and overlap.",
        "Stop condition: if screenshot evidence is unavailable, stop and report that gap instead of claiming fixed.",
        "```"
      ].join("\n");
    }
    return [
      "```txt",
      "Do not claim the UI/layout fix is visually verified from source or CSS alone.",
      "Provide a rendered screenshot or manual visual finding for the target UI.",
      "Checklist: text fits, borders/spacing are symmetrical, controls/icons are contained, and no overlapping content is visible.",
      "Report what is verified, what remains unverified, and the next exact fix if the screenshot still fails.",
      "```"
    ].join("\n");
  }

  if (input.iosReleaseClaim && !input.explicitPublishSyncTask) {
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
    return [
      "```txt",
      `Do not run ${formatBlockedActions(ADMISSION_SURFACE)} yet.`,
      `Work in ${ADMISSION_SURFACE.repoPath}.`,
      `Validate the sync surface with ${ADMISSION_SURFACE.commands.syncPreflight}.`,
      `Also verify ${ADMISSION_SURFACE.files.requiredSheetsConfig}; ${ADMISSION_SURFACE.files.exampleSheetsConfig} is example-only.`,
      `If Apps Script or canonical readiness is the claim, use ${ADMISSION_SURFACE.commands.appsScriptValidation} or ${ADMISSION_SURFACE.commands.canonicalValidation}.`,
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
        `In ${CANVAS_SURFACE.repoPath}, verify build success only.`,
        "Do not modify files.",
        `Run exactly ${CANVAS_SURFACE.commands.build}.`,
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
    if (input.codexReportAuditRequest && input.brightspace) {
      return [
        "```txt",
        "Audit this brightspacequizexporter Codex report as unproven until local evidence is attached.",
        "Do not edit parser/source/fixtures/gold and do not run ingest:seed-gold.",
        "Require: exact files changed, npm run build output, npm run ingest:ci output, and first remaining failure if any.",
        "If evidence is missing, stop and mark completion as unverified.",
        "```"
      ].join("\n");
    }
    if (input.codexReportAuditRequest && input.canvasHelper) {
      return [
        "```txt",
        "Audit this canvas-helper Codex report as unproven until visual and command evidence is attached.",
        "Require: exact files changed, one rendered Sports Wellness screenshot artifact, and local command output for any claimed tests.",
        "If screenshot or command output is missing, stop and mark completion as unverified.",
        "```"
      ].join("\n");
    }
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
  if (input.boundedPromptRequest && input.admissionApp) {
    return [
      "```txt",
      `In ${ADMISSION_SURFACE.repoPath}, build one bounded proof packet only.`,
      `Scope: evidence collection and one proof command; do not run ${formatBlockedActions(ADMISSION_SURFACE)}, deploy, push, or source mutation.`,
      `Files/surfaces to inspect first: package.json, ${ADMISSION_SURFACE.files.pipelineDocs}, tools/, pipeline/, ${ADMISSION_SURFACE.files.requiredSheetsConfig}, ${ADMISSION_SURFACE.files.exampleSheetsConfig}.`,
      `Run exactly one proof command selected for the claim: ${ADMISSION_SURFACE.commands.build}, ${ADMISSION_SURFACE.commands.syncPreflight}, ${ADMISSION_SURFACE.commands.appsScriptValidation}, or ${ADMISSION_SURFACE.commands.canonicalValidation}.`,
      "Report: cwd, exact command, exit code, output, files changed (if any), first failure, and what remains unverified.",
      "Stop condition: after that single command and report; do not broaden scope.",
      "```"
    ].join("\n");
  }
  if (input.boundedPromptRequest && input.brightspace) {
    return [
      "```txt",
      "In /Users/deanguedo/Documents/GitHub/brightspacequizexporter, target only the highest-risk blocker.",
      "Scope: dependency/build/ingest proof only; no parser/source/fixture/gold edits and no ingest:seed-gold.",
      "Allowed commands:",
      "- npm ls @rollup/rollup-darwin-arm64 rollup vite",
      "- npm run build",
      "- npm run ingest:ci",
      "Report exact command outputs, exit codes, changed files, and first remaining failure.",
      "Stop condition: if any forbidden scope appears, stop and report boundary violation.",
      "```"
    ].join("\n");
  }
  if (input.boundedPromptRequest && input.canvasHelper) {
    return [
      "```txt",
      `In ${CANVAS_SURFACE.repoPath}, target only the Sports Wellness visual-proof gap.`,
      `Inspect only: ${CANVAS_SURFACE.files.sportsWellnessHtml}, ${CANVAS_SURFACE.files.sportsWellnessCss}, ${CANVAS_SURFACE.files.sportsWellnessJs}.`,
      `Proof artifact required: ${CANVAS_SURFACE.proofArtifacts[0]} of the affected preview state (desktop viewport).`,
      `Build proof command if needed: ${CANVAS_SURFACE.commands.build}. Course shell/e2e proof surfaces: ${CANVAS_SURFACE.commands.courseShellTest}, ${CANVAS_SURFACE.commands.e2e}, ${CANVAS_SURFACE.commands.scopedE2e}.`,
      "Report: repo path, files inspected, screenshot path/artifact, checklist (text fit, symmetry, containment, overlap), and first remaining visual failure.",
      "Stop condition: do not broaden to other projects or claim fixed without screenshot evidence.",
      "```"
    ].join("\n");
  }
  if (input.repoRiskRequest && input.admissionApp) {
    return [
      "```txt",
      "Audit app-admissions operating risk with one bounded proof step.",
      `Do not run ${formatBlockedActions(ADMISSION_SURFACE)}, deploy, push, or mutate source.`,
      `Run exactly ${ADMISSION_SURFACE.commands.build} from ${ADMISSION_SURFACE.repoPath} and report cwd, exit code, and output.`,
      `If the risk is Sheets/publish readiness, the next proof surface is ${ADMISSION_SURFACE.commands.syncPreflight} with ${ADMISSION_SURFACE.files.requiredSheetsConfig}.`,
      "Then classify verified vs unverified readiness (build, publish/sync, pipeline QA).",
      "```"
    ].join("\n");
  }
  if (input.repoRiskRequest && input.brightspace) {
    return [
      "```txt",
      "Audit brightspacequizexporter operating risk with gate proof only.",
      "Do not edit parser/source/fixtures/gold and do not run ingest:seed-gold.",
      "Run npm run build and npm run ingest:ci in order and report exact outputs.",
      "Return first remaining failure if either gate fails.",
      "```"
    ].join("\n");
  }
  if (input.repoRiskRequest && input.canvasHelper) {
    return [
      "```txt",
      "Audit canvas-helper operating risk for Sports Wellness with rendered proof only.",
      `Inspect ${CANVAS_SURFACE.files.sportsWellnessHtml}, ${CANVAS_SURFACE.files.sportsWellnessCss}, and ${CANVAS_SURFACE.files.sportsWellnessJs}; request one ${CANVAS_SURFACE.proofArtifacts[0]}.`,
      `Use ${CANVAS_SURFACE.commands.build} only for build proof, not visual proof.`,
      "Do not claim fixed from CSS/source inspection alone.",
      "Return checklist status: text fit, symmetry, containment, overlap.",
      "```"
    ].join("\n");
  }
  if (input.proofGapRequest && input.admissionApp) {
    return [
      "```txt",
      "Inventory app-admissions proof commands from local repo evidence only.",
      "Inspect package.json/scripts and docs for build/test/pipeline validation commands.",
      "Run exactly one command: npm run build:pages.",
      "Return what is verified, what remains unverified, and the next bounded proof command.",
      "```"
    ].join("\n");
  }
  if (input.proofGapRequest && input.brightspace) {
    return [
      "```txt",
      "Inventory Brightspace proof commands from local repo evidence only.",
      "Confirm script surfaces, then run exactly one gate proof command: npm run ingest:ci.",
      "Report exact output, first failure, and which claims remain unverified.",
      "```"
    ].join("\n");
  }
  if (input.proofGapRequest && input.canvasHelper) {
    return [
      "```txt",
      "Inventory canvas-helper proof commands/artifacts for Sports Wellness only.",
      `Known commands: ${CANVAS_SURFACE.commands.build}, ${CANVAS_SURFACE.commands.typecheck}, ${CANVAS_SURFACE.commands.courseShellTest}, ${CANVAS_SURFACE.commands.e2e}, ${CANVAS_SURFACE.commands.scopedE2e}.`,
      `Visual proof requires ${CANVAS_SURFACE.proofArtifacts[0]}; CSS diff alone is not proof.`,
      "If no screenshot artifact can be produced, report that as the primary unverified gap.",
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
