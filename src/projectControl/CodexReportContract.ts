export type CodexReportContractStatus = "absent" | "well_formed" | "partial" | "malformed";

export type CodexReportContractResult = {
  status: CodexReportContractStatus;
  presentSections: string[];
  missingSections: string[];
  issues: string[];
  claimsCompletion: boolean;
  claimsTests: boolean;
  claimsBuild: boolean;
};

const REQUIRED_SECTIONS = [
  "files_changed",
  "commands_run",
  "what_is_verified",
  "what_is_unverified",
  "risks"
] as const;

type ContractSection = (typeof REQUIRED_SECTIONS)[number];

export function analyzeCodexReportContract(report: string): CodexReportContractResult {
  const normalized = report.trim();
  if (!normalized || /^none supplied\.?$/i.test(normalized)) {
    return {
      status: "absent",
      presentSections: [],
      missingSections: [...REQUIRED_SECTIONS],
      issues: [],
      claimsCompletion: false,
      claimsTests: false,
      claimsBuild: false
    };
  }

  const lower = normalized.toLowerCase();
  const presentSections = REQUIRED_SECTIONS.filter((section) => hasSection(normalized, section));
  const missingSections = REQUIRED_SECTIONS.filter((section) => !presentSections.includes(section));
  const claimsCompletion = /\b(done|fixed|complete|completed|ready)\b/i.test(normalized);
  const claimsTests = /\btests?\s+(pass|passed|green|verified)\b/i.test(normalized);
  const claimsBuild = /\bbuild\s+(pass|passed|green|verified)\b/i.test(normalized);
  const issues: string[] = [];

  if (missingSections.length > 0) {
    issues.push(`missing sections: ${missingSections.map(renderSection).join(", ")}`);
  }
  if ((claimsCompletion || claimsTests || claimsBuild) && !presentSections.includes("commands_run")) {
    issues.push("completion or pass claims require a Commands run section");
  }
  if ((claimsCompletion || claimsTests || claimsBuild) && !presentSections.includes("what_is_unverified")) {
    issues.push("completion or pass claims must still name what remains unverified");
  }
  if ((claimsCompletion || claimsTests || claimsBuild) && !/\b(exit code|stdout|stderr|failed|passed|command output)\b/i.test(lower)) {
    issues.push("pass claims mention no command-output details");
  }

  const status: CodexReportContractStatus =
    presentSections.length === REQUIRED_SECTIONS.length && issues.length === 0
      ? "well_formed"
      : presentSections.length >= 2
        ? "partial"
        : "malformed";

  return {
    status,
    presentSections: [...presentSections],
    missingSections: [...missingSections],
    issues,
    claimsCompletion,
    claimsTests,
    claimsBuild
  };
}

function hasSection(report: string, section: ContractSection): boolean {
  switch (section) {
    case "files_changed":
      return /\bfiles changed\s*:/i.test(report);
    case "commands_run":
      return /\bcommands run\s*:/i.test(report);
    case "what_is_verified":
      return /\bwhat is verified\s*:/i.test(report);
    case "what_is_unverified":
      return /\bwhat is unverified\s*:/i.test(report);
    case "risks":
      return /\brisks?\s*:/i.test(report);
  }
}

function renderSection(section: ContractSection): string {
  switch (section) {
    case "files_changed":
      return "Files changed";
    case "commands_run":
      return "Commands run";
    case "what_is_verified":
      return "What is verified";
    case "what_is_unverified":
      return "What is unverified";
    case "risks":
      return "Risks";
  }
}
