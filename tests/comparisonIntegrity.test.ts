import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateComparisonRunIntegrity } from "../src/campaign/ComparisonIntegrity.js";

const GOOD_OUTPUT =
  "## Verdict\nok\n## Verified\nok\n## Weak / Provisional\nok\n## Unverified\nok\n## Risk\nok\n## One Next Action\nok\n## Codex Prompt if needed\nok";

async function writeRun(
  baseDir: string,
  runId: string,
  options?: {
    chatgptOutput?: string;
    extraScoreFile?: { name: string; content: string };
    reportOverride?: string;
  }
) {
  const runDir = path.join(baseDir, runId);
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(
    path.join(runDir, "manifest.json"),
    JSON.stringify(
      {
        runId,
        createdAt: "2026-04-30T00:00:00.000Z",
        caseCount: 1,
        staxSource: "local_cli",
        chatgptSource: "raw_chatgpt_browser",
        scoringRubricVersion: "v1",
        criticalMissRulesVersion: "v1",
        canonicalScoresFile: "scores.json",
        canonicalReportFile: "report.md"
      },
      null,
      2
    )
  );
  await fs.writeFile(path.join(runDir, "cases.json"), JSON.stringify({ cases: [{ taskId: "case_001" }] }, null, 2));
  await fs.writeFile(
    path.join(runDir, "captures.json"),
    JSON.stringify(
      {
        captures: [
          {
            taskId: "case_001",
            staxOutput: GOOD_OUTPUT,
            chatgptOutput: options?.chatgptOutput ?? GOOD_OUTPUT
          }
        ]
      },
      null,
      2
    )
  );
  await fs.writeFile(
    path.join(runDir, "scores.json"),
    JSON.stringify(
      {
        entries: [
          {
            taskId: "case_001",
            staxScore: 9,
            chatgptScore: 7,
            staxCriticalMiss: false,
            chatgptCriticalMiss: false
          }
        ]
      },
      null,
      2
    )
  );
  await fs.writeFile(
    path.join(runDir, "report.md"),
    options?.reportOverride ??
      ["# Report", "", "## Summary", "- Total scored cases: 1", "- STAX wins: 1", "- ChatGPT wins: 0", "- Ties: 0", "- STAX critical misses: 0", "- ChatGPT critical misses: 0"].join("\n")
  );
  if (options?.extraScoreFile) {
    await fs.writeFile(path.join(runDir, options.extraScoreFile.name), options.extraScoreFile.content);
  }
}

describe("validateComparisonRunIntegrity", () => {
  it("passes on a clean run", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-integrity-"));
    await writeRun(baseDir, "clean");
    const result = await validateComparisonRunIntegrity({ runId: "clean", baseDir });
    expect(result.pass).toBe(true);
  });

  it("fails on corrupted capture rows", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-integrity-"));
    await writeRun(baseDir, "bad-capture", { chatgptOutput: "please copy this response now" });
    const result = await validateComparisonRunIntegrity({ runId: "bad-capture", baseDir });
    expect(result.pass).toBe(false);
    expect(result.issues.some((i) => i.code === "corrupted_capture")).toBe(true);
  });

  it("fails when conflicting score files exist", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-integrity-"));
    await writeRun(baseDir, "conflict", { extraScoreFile: { name: "scores_backup.json", content: "{}" } });
    const result = await validateComparisonRunIntegrity({ runId: "conflict", baseDir });
    expect(result.pass).toBe(false);
    expect(result.issues.some((i) => i.code === "conflicting_score_files")).toBe(true);
  });

  it("fails when stale score file is marked current", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-integrity-"));
    await writeRun(baseDir, "stale-current", {
      extraScoreFile: { name: "scores_old.json", content: JSON.stringify({ isCurrent: true }) }
    });
    const result = await validateComparisonRunIntegrity({ runId: "stale-current", baseDir });
    expect(result.pass).toBe(false);
    expect(result.issues.some((i) => i.code === "stale_score_marked_current")).toBe(true);
  });

  it("fails when report summary mismatches scores", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-integrity-"));
    await writeRun(baseDir, "mismatch", {
      reportOverride: ["# Report", "", "## Summary", "- Total scored cases: 1", "- STAX wins: 0", "- ChatGPT wins: 1", "- Ties: 0", "- STAX critical misses: 0", "- ChatGPT critical misses: 0"].join("\n")
    });
    const result = await validateComparisonRunIntegrity({ runId: "mismatch", baseDir });
    expect(result.pass).toBe(false);
    expect(result.issues.some((i) => i.code === "report_score_mismatch")).toBe(true);
  });
});
