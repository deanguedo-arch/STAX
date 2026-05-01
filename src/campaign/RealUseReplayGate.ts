import fs from "node:fs/promises";
import path from "node:path";
import { createDefaultRuntime } from "../core/RaxRuntime.js";
import type { RealUseCampaignLedger } from "./RealUseCampaignIntegrity.js";

export type RealUseReplayExpectation = {
  taskId: string;
  required: string[];
  forbidden: string[];
};

export type RealUseReplayCaseResult = {
  taskId: string;
  pass: boolean;
  missing: string[];
  forbiddenFound: string[];
};

export type RealUseReplayResult = {
  status: "passed" | "failed";
  total: number;
  passed: number;
  failed: number;
  cases: RealUseReplayCaseResult[];
};

export const DOGFOOD_REPLAY_EXPECTATIONS: RealUseReplayExpectation[] = [
  {
    taskId: "real_codex_001",
    required: ["validate-sync-surface.ps1", "config/sheets_sync.json", "PUBLISH_DATA_TO_SHEETS.bat"],
    forbidden: ["TestFlight", "mobile/ios-wrapper"]
  },
  {
    taskId: "real_codex_002",
    required: ["rendered screenshot/checklist", "Sports Wellness", "checkmark containment"],
    forbidden: ["brightspacequizexporter"]
  },
  {
    taskId: "real_codex_003",
    required: ["STAX", "npm run typecheck", "npm test", "npm run rax -- eval"],
    forbidden: ["ADMISSION-APP build", "TestFlight", "Sports Wellness"]
  },
  {
    taskId: "real_codex_004",
    required: ["data-contract", "ALBERTA_ADMISSIONS_MASTER_CANONICAL.csv", "blank rates"],
    forbidden: ["TestFlight", "mobile/ios-wrapper", "SYNC_ALL"]
  },
  {
    taskId: "real_codex_005",
    required: ["data-contract", "ALBERTA_ADMISSIONS_MASTER_CANONICAL.csv", "blank rates"],
    forbidden: ["TestFlight", "mobile/ios-wrapper", "SYNC_ALL"]
  },
  {
    taskId: "real_codex_006",
    required: ["Avg_Total", "canonical data", "dry-run"],
    forbidden: ["SYNC_ALL", "TestFlight"]
  },
  {
    taskId: "real_codex_007",
    required: ["Avg_Total", "data gap", "ADMISSION-APP"],
    forbidden: ["SYNC_ALL", "TestFlight", "mobile/ios-wrapper"]
  },
  {
    taskId: "real_codex_008",
    required: ["brightspacequizexporter", "npm ls @rollup/rollup-darwin-arm64 rollup vite"],
    forbidden: ["ADMISSION-APP", "TestFlight", "Sheets sync"]
  },
  {
    taskId: "real_codex_009",
    required: ["npm run build", "npm run ingest:ci", "Brightspace"],
    forbidden: ["ADMISSION-APP", "TestFlight"]
  },
  {
    taskId: "real_codex_010",
    required: ["STAX", "dogfood", "npm run typecheck", "npm test"],
    forbidden: ["ADMISSION-APP build", "TestFlight", "Sheets sync"]
  }
];

export function evaluateRealUseReplayOutput(output: string, expectation: RealUseReplayExpectation): RealUseReplayCaseResult {
  const missing = expectation.required.filter((needle) => !output.includes(needle));
  const forbiddenFound = expectation.forbidden.filter((needle) => output.includes(needle));
  return {
    taskId: expectation.taskId,
    pass: missing.length === 0 && forbiddenFound.length === 0,
    missing,
    forbiddenFound
  };
}

export async function runRealUseReplayGate(input: {
  ledgerPath?: string;
} = {}): Promise<RealUseReplayResult> {
  const ledgerPath = input.ledgerPath ?? path.join(process.cwd(), "fixtures", "real_use", "dogfood_10_tasks_2026-04-30.json");
  const ledger = JSON.parse(await fs.readFile(ledgerPath, "utf8")) as RealUseCampaignLedger;
  const runtime = await createDefaultRuntime();
  const cases: RealUseReplayCaseResult[] = [];

  for (const expectation of DOGFOOD_REPLAY_EXPECTATIONS) {
    const task = ledger.tasks.find((entry) => entry.taskId === expectation.taskId);
    if (!task) {
      cases.push({ taskId: expectation.taskId, pass: false, missing: ["task missing from ledger"], forbiddenFound: [] });
      continue;
    }
    if (!task.task) {
      cases.push({ taskId: expectation.taskId, pass: false, missing: ["task text missing from ledger"], forbiddenFound: [] });
      continue;
    }
    const result = await runtime.run(task.task, [], { mode: "project_control" });
    cases.push(evaluateRealUseReplayOutput(result.output, expectation));
  }

  const passed = cases.filter((item) => item.pass).length;
  return {
    status: passed === cases.length ? "passed" : "failed",
    total: cases.length,
    passed,
    failed: cases.length - passed,
    cases
  };
}
