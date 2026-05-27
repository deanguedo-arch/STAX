import fs from "node:fs/promises";
import path from "node:path";
import { readTextIfExists, sidecarDir, validateRepoPath } from "./SidecarRepo.js";
import type { StaxTurnContract } from "./TurnContract.js";

export type TurnComplianceMode = "strict" | "normal" | "manual";

export type TurnComplianceIssue = {
  message: string;
  severity: "weak" | "reject";
};

export type TurnComplianceResult = {
  pass: boolean;
  issues: TurnComplianceIssue[];
  severity: "weak" | "reject" | "pass";
  acknowledgement?: string;
  contract?: StaxTurnContract;
};

export type CheckTurnComplianceOptions = {
  repoPath: string;
  codexReportText?: string;
  currentTurnCaptureText?: string;
  mode?: TurnComplianceMode;
  codexClaimsCompletion?: boolean;
  hasDiff?: boolean;
  skipReportMtime?: boolean;
};

const REPORT_MTIME_GRANULARITY_TOLERANCE_MS = 1000;

function parseJsonObject(raw: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function parseTurnContract(raw: string): StaxTurnContract | undefined {
  const parsed = parseJsonObject(raw);
  if (
    parsed?.schemaVersion !== "stax-turn-contract-v1" ||
    typeof parsed.turnId !== "string" ||
    typeof parsed.generatedAt !== "string" ||
    typeof parsed.statusHash !== "string" ||
    typeof parsed.nextPromptHash !== "string" ||
    typeof parsed.requiredAcknowledgement !== "string"
  ) {
    return undefined;
  }
  return parsed as StaxTurnContract;
}

function currentTurnText(raw: string): string {
  if (!raw.trim()) return "";
  const parsed = parseJsonObject(raw);
  if (!parsed) return raw;
  const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
  return messages
    .map((message) => {
      if (!message || typeof message !== "object") return "";
      const text = (message as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n");
}

function severityForMissingAck(mode: TurnComplianceMode, input: { codexClaimsCompletion: boolean; hasDiff: boolean }): "weak" | "reject" {
  if (mode === "manual") return "weak";
  if (mode === "strict") return "reject";
  return input.codexClaimsCompletion || input.hasDiff ? "reject" : "weak";
}

async function reportMtimeMs(repoPath: string): Promise<number | undefined> {
  const reportPath = path.join(sidecarDir(repoPath), "codex-report.md");
  const stat = await fs.stat(reportPath).catch(() => undefined);
  return stat?.mtimeMs;
}

export async function checkTurnCompliance(options: CheckTurnComplianceOptions): Promise<TurnComplianceResult> {
  const repoPath = await validateRepoPath(options.repoPath);
  const mode = options.mode ?? "normal";
  const codexReportText = options.codexReportText ?? (await readTextIfExists(path.join(sidecarDir(repoPath), "codex-report.md")));
  const currentTurnCaptureText =
    options.currentTurnCaptureText ?? (await readTextIfExists(path.join(sidecarDir(repoPath), "current-turn.json")));
  const contractRaw = await readTextIfExists(path.join(sidecarDir(repoPath), "turn-contract.json"));
  const missingAckInput = {
    codexClaimsCompletion: options.codexClaimsCompletion ?? false,
    hasDiff: options.hasDiff ?? false
  };
  const issues: TurnComplianceIssue[] = [];

  if (!contractRaw.trim()) {
    const severity = severityForMissingAck(mode, missingAckInput);
    issues.push({
      severity,
      message: ".stax/turn-contract.json is missing; Codex cannot prove it read the current STAX sidecar state."
    });
    return summarize(issues);
  }

  const contract = parseTurnContract(contractRaw);
  if (!contract) {
    issues.push({
      severity: "reject",
      message: ".stax/turn-contract.json is malformed."
    });
    return summarize(issues);
  }

  const expectedAck = contract.requiredAcknowledgement;
  const reportContainsExpectedAck = codexReportText.includes(expectedAck);
  if (!reportContainsExpectedAck) {
    const severity = severityForMissingAck(mode, missingAckInput);
    issues.push({
      severity,
      message: ".stax/codex-report.md is missing the current STAX acknowledgement from .stax/turn-contract.json."
    });
  }

  const ackPattern = /\bSTAX_ACK\s+(\S+)\s+([a-f0-9]{8,64})\s+([a-f0-9]{8,64})\b/i;
  const reportedAck = codexReportText.match(ackPattern);
  if (reportedAck && reportedAck[0] !== expectedAck) {
    issues.push({
      severity: "reject",
      message: "STAX acknowledgement is stale or does not match the current turn contract."
    });
    if (reportedAck[1] !== contract.turnId) {
      issues.push({ severity: "reject", message: "STAX acknowledgement turnId does not match the current contract." });
    }
    if (reportedAck[2] !== contract.statusHash) {
      issues.push({ severity: "reject", message: "STAX acknowledgement statusHash does not match the current contract." });
    }
    if (reportedAck[3] !== contract.nextPromptHash) {
      issues.push({ severity: "reject", message: "STAX acknowledgement nextPromptHash does not match the current contract." });
    }
  }

  const capturedText = currentTurnText(currentTurnCaptureText);
  if (currentTurnCaptureText.trim() && !capturedText.includes(expectedAck)) {
    const severity = mode === "strict" ? "reject" : reportContainsExpectedAck || mode === "manual" ? "weak" : "reject";
    issues.push({
      severity,
      message: reportContainsExpectedAck
        ? "Current Codex turn capture does not contain the current STAX acknowledgement; report acknowledgement is present, so this may be capture lag."
        : "Current Codex turn capture does not contain the current STAX acknowledgement."
    });
  }

  const generatedAtMs = Date.parse(contract.generatedAt);
  const modifiedAtMs = options.skipReportMtime ? undefined : await reportMtimeMs(repoPath);
  if (
    Number.isFinite(generatedAtMs) &&
    modifiedAtMs !== undefined &&
    modifiedAtMs + REPORT_MTIME_GRANULARITY_TOLERANCE_MS < generatedAtMs
  ) {
    issues.push({
      severity: severityForMissingAck(mode, missingAckInput),
      message: ".stax/codex-report.md is older than the current STAX turn contract."
    });
  }

  const result = summarize(issues);
  return {
    ...result,
    acknowledgement: expectedAck,
    contract
  };
}

function summarize(issues: TurnComplianceIssue[]): TurnComplianceResult {
  const severity = issues.some((issue) => issue.severity === "reject") ? "reject" : issues.length > 0 ? "weak" : "pass";
  return {
    pass: issues.length === 0,
    issues,
    severity
  };
}
