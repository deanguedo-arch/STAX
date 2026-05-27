import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAttachedRepoImpactPlan,
  parseAttachedRepoImpactArgs
} from "../scripts/runAttachedRepoImpactExport.js";

describe("attached repo impact export runner", () => {
  it("builds the guarded work-terminal command plan without executing repos", () => {
    const outDir = path.resolve("/tmp/stax-impact");
    const plan = buildAttachedRepoImpactPlan({
      repos: ["/repos/canvas-helper", "/repos/brightspacequizexporter"],
      outDir,
      dryRun: true,
      generatedAt: "2026-05-27T00:00:00.000Z"
    });

    expect(plan.schemaVersion).toBe("stax-attached-repo-impact-export-plan-v1");
    expect(plan.requiresCurrentRepoConfirmation).toBe(true);
    expect(plan.entries).toHaveLength(2);
    expect(plan.entries[0]!.outFile).toBe(path.join(outDir, "canvas-helper-impact.json"));
    expect(plan.entries[0]!.commands.map((command) => command.label)).toEqual([
      "sidecar-upgrade-discover-surfaces",
      "sidecar-gate",
      "sidecar-next-prompt",
      "export-impact-evidence"
    ]);
    expect(plan.entries[0]!.commands[1]!.allowNonZero).toBe(true);
    expect(plan.entries[0]!.commands[3]!.args.join(" ")).toContain("canvas-helper-impact.json");
  });

  it("parses repeated repos and confirmation flags", () => {
    const parsed = parseAttachedRepoImpactArgs([
      "--repo",
      "/repos/canvas-helper",
      "--repo=/repos/ADMISSION-APP",
      "--out-dir",
      "exports",
      "--confirm-current-repos",
      "--continue-on-error"
    ]);

    expect(parsed.repos).toEqual(["/repos/canvas-helper", "/repos/ADMISSION-APP"]);
    expect(parsed.outDir).toBe(path.resolve(process.cwd(), "exports"));
    expect(parsed.confirmCurrentRepos).toBe(true);
    expect(parsed.continueOnError).toBe(true);
  });

  it("requires at least one repo", () => {
    expect(() => buildAttachedRepoImpactPlan({ repos: [], outDir: "/tmp/out" })).toThrow(/--repo <path>/);
  });
});
