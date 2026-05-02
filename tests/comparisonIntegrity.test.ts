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
    staxOutput?: string;
    repoFullName?: string;
    secondCapture?: {
      taskId: string;
      repoFullName: string;
      staxOutput: string;
      chatgptOutput: string;
    };
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
  const cases = [
    { taskId: "case_001" },
    ...(options?.secondCapture ? [{ taskId: options.secondCapture.taskId }] : [])
  ];
  await fs.writeFile(path.join(runDir, "cases.json"), JSON.stringify({ cases }, null, 2));
  await fs.writeFile(
    path.join(runDir, "captures.json"),
    JSON.stringify(
      {
        captures: [
          {
            taskId: "case_001",
            repoFullName: options?.repoFullName,
            staxOutput: options?.staxOutput ?? GOOD_OUTPUT,
            chatgptOutput: options?.chatgptOutput ?? GOOD_OUTPUT
          },
          ...(options?.secondCapture ? [options.secondCapture] : [])
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
          },
          ...(options?.secondCapture
            ? [
                {
                  taskId: options.secondCapture.taskId,
                  staxScore: 9,
                  chatgptScore: 7,
                  staxCriticalMiss: false,
                  chatgptCriticalMiss: false
                }
              ]
            : [])
        ]
      },
      null,
      2
    )
  );
  await fs.writeFile(
    path.join(runDir, "report.md"),
    options?.reportOverride ??
      [
        "# Report",
        "",
        "## Summary",
        `- Total scored cases: ${cases.length}`,
        `- STAX wins: ${cases.length}`,
        "- ChatGPT wins: 0",
        "- Ties: 0",
        "- STAX critical misses: 0",
        "- ChatGPT critical misses: 0"
      ].join("\n")
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

  it("fails on embedded benchmark prompt contamination", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-integrity-"));
    await writeRun(baseDir, "bad-prompt-capture", {
      chatgptOutput: `${GOOD_OUTPUT}\nYou are raw ChatGPT in a public-repo project-control benchmark.\nCase ID: bad_case\nCritical miss rules: none`
    });
    const result = await validateComparisonRunIntegrity({ runId: "bad-prompt-capture", baseDir });
    expect(result.pass).toBe(false);
    expect(result.issues.some((i) => i.code === "corrupted_capture" && /embedded_benchmark_prompt/.test(i.message))).toBe(true);
  });

  it("allows ordinary repo, archetype, and supplied-evidence labels in a valid audit answer", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-integrity-"));
    await writeRun(baseDir, "repo-archetype-labels", {
      chatgptOutput: `${GOOD_OUTPUT}\nRepo: vitejs/vite\nArchetype: js_build_tooling\nSupplied evidence: no command evidence was supplied.`
    });
    const result = await validateComparisonRunIntegrity({ runId: "repo-archetype-labels", baseDir });
    expect(result.pass).toBe(true);
  });

  it("fails on UI capture contamination", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-integrity-"));
    await writeRun(baseDir, "bad-ui-capture", {
      chatgptOutput: `${GOOD_OUTPUT}\nThought for 7s\nHeavy\nRetry`
    });
    const result = await validateComparisonRunIntegrity({ runId: "bad-ui-capture", baseDir });
    expect(result.pass).toBe(false);
    expect(result.issues.some((i) => i.code === "corrupted_capture" && /ui_capture_text/.test(i.message))).toBe(true);
  });

  it("fails when one capture contains more than one verdict section", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-integrity-"));
    await writeRun(baseDir, "bad-multi-verdict", {
      chatgptOutput: `${GOOD_OUTPUT}\n\n${GOOD_OUTPUT}`
    });
    const result = await validateComparisonRunIntegrity({ runId: "bad-multi-verdict", baseDir });
    expect(result.pass).toBe(false);
    expect(result.issues.some((i) => i.code === "corrupted_capture" && /multiple_required_sections/.test(i.message))).toBe(true);
  });

  it("fails on exact other-repo contamination", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-integrity-"));
    await writeRun(baseDir, "bad-other-repo", {
      repoFullName: "storybookjs/storybook",
      chatgptOutput: `${GOOD_OUTPUT}\nThis answer accidentally cites laravel/framework.`,
      secondCapture: {
        taskId: "case_002",
        repoFullName: "laravel/framework",
        staxOutput: GOOD_OUTPUT,
        chatgptOutput: GOOD_OUTPUT
      },
      reportOverride: ["# Report", "", "## Summary", "- Total scored cases: 2", "- STAX wins: 2", "- ChatGPT wins: 0", "- Ties: 0", "- STAX critical misses: 0", "- ChatGPT critical misses: 0"].join("\n")
    });
    const result = await validateComparisonRunIntegrity({ runId: "bad-other-repo", baseDir });
    expect(result.pass).toBe(false);
    expect(result.issues.some((i) => i.code === "corrupted_capture" && /wrong_repo_contamination/.test(i.message))).toBe(true);
  });

  it("uses the shared capture validator for subscription capture corruption", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-integrity-"));
    await writeRun(baseDir, "bad-phase11-capture", { chatgptOutput: `${GOOD_OUTPUT}\nfailed to copy to clipboard` });
    const result = await validateComparisonRunIntegrity({ runId: "bad-phase11-capture", baseDir });
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

  it("uses canonical winner fields when present", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "stax-integrity-"));
    const runId = "winner-canonical";
    await writeRun(baseDir, runId);
    const runDir = path.join(baseDir, runId);
    await fs.writeFile(
      path.join(runDir, "scores.json"),
      JSON.stringify(
        {
          entries: [
            {
              taskId: "case_001",
              staxScore: 9,
              chatgptScore: 1,
              staxCriticalMiss: false,
              chatgptCriticalMiss: false,
              winner: "tie"
            }
          ]
        },
        null,
        2
      )
    );
    await fs.writeFile(
      path.join(runDir, "report.md"),
      ["# Report", "", "## Summary", "- Total scored cases: 1", "- STAX wins: 0", "- ChatGPT wins: 0", "- Ties: 1", "- STAX critical misses: 0", "- ChatGPT critical misses: 0"].join("\n")
    );

    const result = await validateComparisonRunIntegrity({ runId, baseDir });
    expect(result.pass).toBe(true);
    expect(result.summary?.ties).toBe(1);
  });
});
