import { ProofBoundaryClassifier } from "./ProofBoundaryClassifier.js";
import { RuntimeEvidenceGate } from "./RuntimeEvidenceGate.js";
import {
  EvidenceRequestInputSchema,
  EvidenceRequestResultSchema,
  type EvidenceRequestInput,
  type EvidenceRequestResult
} from "./EvidenceRequestSchemas.js";

export class EvidenceRequestBuilder {
  build(input: EvidenceRequestInput): EvidenceRequestResult {
    const parsed = EvidenceRequestInputSchema.parse(input);
    const text = `${parsed.task}\n${parsed.availableEvidence}`;
    const kind = requestKind(text);
    const runtime = new RuntimeEvidenceGate().evaluate({ claim: parsed.task, evidence: parsed.availableEvidence, repo: parsed.repo });
    const boundary = new ProofBoundaryClassifier().classify({ claim: parsed.task, evidence: parsed.availableEvidence });
    const exampleCommand = runtime.requiredNextCommand ?? commandFor(kind);
    const minimumEvidenceNeeded = evidenceFor(kind, boundary.requiredNextProof);
    return EvidenceRequestResultSchema.parse({
      reason: parsed.reason || "no_local_basis",
      requestKind: kind,
      minimumEvidenceNeeded,
      pasteBackInstructions: pasteBackFor(kind, minimumEvidenceNeeded, exampleCommand),
      exampleCommand,
      canProceedWithoutEvidence: false
    });
  }
}

function requestKind(text: string): EvidenceRequestResult["requestKind"] {
  if (/\b(screenshot|visual|rendered|layout|text fit|checkmark|ui|css)\b/i.test(text)) return "ui_question";
  if (/\bcodex report|final report|diff summary|file list\b/i.test(text)) return "codex_report";
  if (/\bdeploy|deployment|release|pages|hosting|environment\b/i.test(text)) return "deploy_issue";
  if (/\btests? pass|build pass|runtime|command output|exit code\b/i.test(text)) return "runtime_claim";
  if (/\brepo|package\.json|src\/|tests?\/|script\b/i.test(text)) return "repo_question";
  return "unknown";
}

function evidenceFor(kind: EvidenceRequestResult["requestKind"], boundaryProof: string[]): string[] {
  if (kind === "ui_question") return ["screenshot or rendered visual finding", "target checks", "relevant files"];
  if (kind === "codex_report") return ["file list", "diff summary", "command output with exit code"];
  if (kind === "deploy_issue") return ["build output", "deploy output", "target environment"];
  if (kind === "runtime_claim") return ["exact command", "working directory", "full command output", "exit code"];
  if (kind === "repo_question") return ["package.json scripts", "relevant file or diff", "command output with exit code"];
  return boundaryProof.length ? boundaryProof : ["local evidence tied to the claim"];
}

function commandFor(kind: EvidenceRequestResult["requestKind"]): string {
  if (kind === "deploy_issue") return "npm run build";
  if (kind === "runtime_claim") return "npm test";
  if (kind === "repo_question") return "npm test";
  return "n/a";
}

function pasteBackFor(kind: EvidenceRequestResult["requestKind"], needed: string[], command: string): string {
  if (kind === "ui_question") return `Paste ${needed.join(", ")}.`;
  if (command === "n/a") return `Paste ${needed.join(", ")}.`;
  return `Run \`${command}\` and paste ${needed.join(", ")}.`;
}
