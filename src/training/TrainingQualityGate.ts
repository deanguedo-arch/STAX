import fs from "node:fs/promises";

export type TrainingQualityIssue = {
  severity: "minor" | "major" | "critical";
  message: string;
};

export type TrainingQualityResult = {
  passed: boolean;
  issues: TrainingQualityIssue[];
  recordsChecked: number;
};

export class TrainingQualityGate {
  async checkFile(file: string): Promise<TrainingQualityResult> {
    const raw = await fs.readFile(file, "utf8");
    const rows = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const issues: TrainingQualityIssue[] = [];
    rows.forEach((row, index) => {
      const text = JSON.stringify(row);
      if (/approvalState"\s*:\s*"candidate"|approved"\s*:\s*false/i.test(text)) {
        issues.push({ severity: "critical", message: `Record ${index + 1} appears unapproved.` });
      }
      if (/synthetic"\s*:\s*true/i.test(text) && !/synthetic/i.test(String(row.source ?? row.metadata ?? text))) {
        issues.push({ severity: "major", message: `Record ${index + 1} is synthetic but lacks clear synthetic provenance.` });
      }
      if (/OPENAI_API_KEY|Bearer\s+[A-Za-z0-9._-]+|PRIVATE KEY/i.test(text)) {
        issues.push({ severity: "critical", message: `Record ${index + 1} may contain secret material.` });
      }
      if ((row.chosen === "" || row.rejected === "") || (row.prompt === "" && row.output === "")) {
        issues.push({ severity: "major", message: `Record ${index + 1} has empty training fields.` });
      }
    });
    return {
      passed: !issues.some((issue) => issue.severity === "critical" || issue.severity === "major"),
      issues,
      recordsChecked: rows.length
    };
  }
}
