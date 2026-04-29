import { commandFamilyFor, type CommandEvidence } from "./CommandEvidenceStore.js";
import {
  EvidenceGroundingInputSchema,
  EvidenceGroundingResultSchema,
  type EvidenceGroundingInput,
  type GroundedClaim,
  type GroundedClaimKind
} from "./EvidenceGroundingSchemas.js";

const COMMAND_PATTERN = /\b(?:npm|pnpm|yarn|npx)\s+(?:run\s+)?[a-z0-9:_@./-]+(?:\s+[a-z0-9:_@./=-]+)*/gi;
const FILE_PATTERN = /\b(?:[A-Za-z0-9_.-]+\/)+(?:[A-Za-z0-9_.-]+)(?:\.[A-Za-z0-9]+)?\b|\b[A-Za-z0-9_.-]+\.(?:ts|tsx|js|jsx|json|md|css|html|yml|yaml)\b/g;
const HARD_PROOF_PATTERN = /\b(?:tests?|typecheck|build|eval|regression|redteam|ingest:ci)\b[^\n.]*\b(?:pass(?:ed|es)?|green|succeed(?:ed|s)?|verified)\b/i;
const COMPLETION_PATTERN = /\b(?:fixed|complete|completed|done|verified|ready to apply|ready for apply)\b/i;

export class EvidenceGroundingGate {
  evaluate(input: EvidenceGroundingInput) {
    const parsed = EvidenceGroundingInputSchema.parse(input);
    const claims: GroundedClaim[] = [];

    for (const filePath of unique(matches(parsed.output, FILE_PATTERN))) {
      if (isLikelyCommandToken(filePath)) continue;
      claims.push(this.fileClaim(filePath, parsed.repoEvidence));
    }

    for (const command of unique(matches(parsed.output, COMMAND_PATTERN).map(normalizeCommand))) {
      claims.push(this.commandClaim(command, parsed.commandEvidence));
    }

    for (const line of parsed.output.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
      if (HARD_PROOF_PATTERN.test(line)) claims.push(this.runtimeProofClaim("test_pass", line, parsed.commandEvidence));
      if (COMPLETION_PATTERN.test(line)) claims.push(this.runtimeProofClaim("completion", line, parsed.commandEvidence));
      if (/\bverified\b/i.test(line)) claims.push(this.runtimeProofClaim("verification", line, parsed.commandEvidence));
    }

    const supportedClaims = claims.filter((claim) => claim.status === "supported");
    const weakClaims = claims.filter((claim) => claim.status === "weak");
    const unsupportedClaims = claims.filter((claim) => claim.status === "unsupported");
    return EvidenceGroundingResultSchema.parse({
      pass: unsupportedClaims.length === 0,
      claims,
      supportedClaims,
      weakClaims,
      unsupportedClaims,
      requiredFixes: unsupportedClaims.map((claim) => `Remove or qualify unsupported ${claim.kind} claim: ${claim.text}`)
    });
  }

  private fileClaim(filePath: string, repoEvidence: EvidenceGroundingInput["repoEvidence"]): GroundedClaim {
    if (!repoEvidence) {
      return { kind: "file_path", text: filePath, status: "weak", reason: "No repo evidence pack was supplied." };
    }
    const known = new Set([
      ...(repoEvidence.inspectedFiles ?? []),
      ...(repoEvidence.importantFiles ?? []),
      ...(repoEvidence.configFiles ?? []),
      ...(repoEvidence.sourceFiles ?? []),
      ...(repoEvidence.testFiles ?? []),
      ...(repoEvidence.docsFiles ?? []),
      ...(repoEvidence.operationalFiles ?? [])
    ].map(normalizePath));
    if (known.has(normalizePath(filePath))) {
      return { kind: "file_path", text: filePath, status: "supported", support: "repo_evidence_pack" };
    }
    return { kind: "file_path", text: filePath, status: "unsupported", reason: "File path was not present in the repo evidence pack." };
  }

  private commandClaim(command: string, evidence: CommandEvidence[]): GroundedClaim {
    const matched = evidence.find((item) => normalizeCommand(item.command) === command);
    if (!matched) return { kind: "command", text: command, status: "weak", reason: "Command is named, but no command output was cited." };
    if (matched.source === "local_stax_command_output") return { kind: "command", text: command, status: "supported", support: matched.commandEvidenceId };
    return { kind: "command", text: command, status: "weak", support: matched.commandEvidenceId, reason: `${matched.source} is provisional evidence.` };
  }

  private runtimeProofClaim(kind: GroundedClaimKind, text: string, evidence: CommandEvidence[]): GroundedClaim {
    const family = commandFamilyFromText(text);
    const strong = evidence.find((item) => item.source === "local_stax_command_output" && item.success && (!family || item.commandFamily === family));
    if (strong) return { kind, text, status: "supported", support: strong.commandEvidenceId };
    const weak = evidence.find((item) => item.success && (!family || item.commandFamily === family));
    if (weak && isProvisionalRuntimeClaim(text, weak.source)) {
      return { kind, text, status: "weak", support: weak.commandEvidenceId, reason: `${weak.source} is provisional evidence.` };
    }
    if (weak) {
      return {
        kind,
        text,
        status: "unsupported",
        support: weak.commandEvidenceId,
        reason: `Hard runtime/completion claim requires local STAX command evidence; ${weak.source} is provisional only.`
      };
    }
    return { kind, text, status: "unsupported", reason: "Runtime/completion claim requires local STAX command evidence." };
  }
}

function matches(input: string, pattern: RegExp): string[] {
  return Array.from(input.matchAll(pattern)).map((match) => match[0].trim()).filter(Boolean);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function normalizeCommand(command: string): string {
  return command.trim().replace(/[`'".,;:]+$/g, "").replace(/\s+/g, " ").toLowerCase();
}

function normalizePath(filePath: string): string {
  return filePath.trim().replace(/\\/g, "/").replace(/^\.?\//, "");
}

function isLikelyCommandToken(value: string): boolean {
  return /^(npm|pnpm|yarn|npx)$/i.test(value);
}

function commandFamilyFromText(text: string): CommandEvidence["commandFamily"] | undefined {
  if (/\btypecheck\b/i.test(text)) return "typecheck";
  if (/\bbuild\b/i.test(text)) return "build";
  if (/\beval --redteam|redteam\b/i.test(text)) return "redteam";
  if (/\beval --regression|regression\b/i.test(text)) return "regression";
  if (/\beval\b/i.test(text)) return "eval";
  if (/\bingest:ci\b/i.test(text)) return "unknown";
  if (/\btests?\b/i.test(text)) return "test";
  const command = matches(text, COMMAND_PATTERN)[0];
  return command ? commandFamilyFor(command) : undefined;
}

function isProvisionalRuntimeClaim(text: string, source: CommandEvidence["source"]): boolean {
  if (source === "local_stax_command_output") return true;
  const sourcePattern =
    source === "codex_reported_command_output"
      ? /\b(?:codex|assistant)\s+(?:reported|said|claimed)|\bcodex-reported\b|\breported by codex\b/i
      : /\b(?:human|user|dean)\s+(?:reported|said|pasted|claimed)|\bhuman-pasted\b|\breported by (?:a )?human\b/i;
  return sourcePattern.test(text) || /\b(?:provisional|weak evidence|unverified report)\b/i.test(text);
}
