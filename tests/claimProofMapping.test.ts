import { describe, expect, it } from "vitest";
import {
  decomposeClaimsFromReport,
  loadClaimDecompositionFixtureCases,
  loadClaimProofFixtureCases,
  mapClaimToProof,
  requiredProofForClaim
} from "../src/claims/ClaimProofMapping.js";

describe("claim-to-proof mapping", () => {
  it("defines required proof for each project-control claim lane", () => {
    expect(requiredProofForClaim("implementation")).toEqual(["source_diff", "behavior_test", "command_evidence_after_diff"]);
    expect(requiredProofForClaim("visual")).toEqual(["rendered_visual_proof"]);
    expect(requiredProofForClaim("data")).toEqual(["data_validation", "row_count_diff", "dry_run_artifact"]);
    expect(requiredProofForClaim("release_deploy")).toContain("rollback_plan");
    expect(requiredProofForClaim("memory_promotion")).toEqual(["human_approval", "source_run_reference"]);
    expect(requiredProofForClaim("eval")).toEqual(["eval_command_evidence"]);
    expect(requiredProofForClaim("dependency")).toEqual(["dependency_inspection", "dependency_build_proof"]);
    expect(requiredProofForClaim("migration")).toContain("migration_rollback_proof");
  });

  it("expands fixture templates into at least 200 claim/proof pairs", async () => {
    const cases = await loadClaimProofFixtureCases();
    expect(cases.length).toBeGreaterThanOrEqual(200);
  });

  it("maps supported, unsupported, and ambiguous claims to the expected verdict", async () => {
    const cases = await loadClaimProofFixtureCases();
    for (const testCase of cases) {
      const result = mapClaimToProof(testCase);
      expect(result.verdict, testCase.caseId).toBe(testCase.expectedVerdict);
    }
  });

  it("detects every unsupported hard claim", async () => {
    const cases = await loadClaimProofFixtureCases();
    const unsupportedHardClaims = cases.filter((testCase) => testCase.hardClaim && !testCase.shouldAccept);
    const misses = unsupportedHardClaims.filter((testCase) => !mapClaimToProof(testCase).unsupportedHardClaim);
    expect(misses.map((testCase) => testCase.caseId)).toEqual([]);
  });

  it("accepts sufficiently supported claims without overblocking", async () => {
    const cases = await loadClaimProofFixtureCases();
    const supportedClaims = cases.filter((testCase) => testCase.shouldAccept);
    const accepted = supportedClaims.filter((testCase) => mapClaimToProof(testCase).verdict === "accept");
    const acceptRate = accepted.length / supportedClaims.length;
    expect(acceptRate).toBeGreaterThanOrEqual(0.85);
  });

  it("keeps ambiguous claims provisional instead of laundering weak proof", () => {
    const result = mapClaimToProof({
      claimType: "implementation",
      claim: "Looks implemented, but no tests yet.",
      hardClaim: false,
      suppliedProof: [{ proofType: "source_diff", strength: "weak", description: "Diff summary only." }]
    });

    expect(result.verdict).toBe("provisional");
    expect(result.unsupportedHardClaim).toBe(false);
    expect(result.missingProof).toContain("behavior_test");
  });

  it("decomposes multi-claim Codex reports into explicit proof lanes", async () => {
    const cases = await loadClaimDecompositionFixtureCases();
    expect(cases).toHaveLength(20);
    for (const testCase of cases) {
      expect(decomposeClaimsFromReport(testCase.report), testCase.caseId).toEqual(testCase.expectedClaims);
    }
  });

  it("does not convert command script names into config or policy claims", () => {
    const claims = decomposeClaimsFromReport([
      "Commands run:",
      "- `npm run test:metadata-policy`",
      "Command output summary with exit codes:",
      "- `npm run test:metadata-policy` exited 0."
    ].join("\n"));

    expect(claims).toEqual([]);
  });

  it("does not convert report metadata, paths, commands, or future gaps into hard claims", () => {
    const claims = decomposeClaimsFromReport([
      "Files changed:",
      "- docs/releases/LIMITED_HARD_GATE/boundary_policy.md",
      "- scripts/syncData.ts",
      "Commands run:",
      "- `npm run release:dry-run`",
      "Command output summary with exit codes:",
      "- `npm run release:dry-run` exited 0.",
      "Changes made:",
      "- Command risk classifier marks release, publish, sync, and data-publish command families as protected risk.",
      "What is unverified:",
      "- Release/deploy/data-publish rollout in another repo.",
      "Risks:",
      "- Config policy review remains future work."
    ].join("\n"));

    expect(claims).toEqual([]);
  });

  it("does not convert explicit non-claims into hard claims", () => {
    const claims = decomposeClaimsFromReport([
      "This does not claim release is ready.",
      "It does not enable deploy, publish, sync, data publish, or config policy changes.",
      "No external shipping action is authorized."
    ].join("\n"));

    expect(claims).toEqual([]);
  });

  it("does not treat release rollback or downgrade framing as migration proof by itself", () => {
    const claims = decomposeClaimsFromReport(
      "Publish readiness claims must be downgraded to preflight until target validation, rollback framing, and explicit approval are present."
    );

    expect(claims.map((claim) => claim.claimType)).not.toContain("migration");
    expect(claims.map((claim) => claim.claimType)).toContain("release_deploy");
  });

  it("still catches real readiness and policy claims after metadata filtering", () => {
    const claims = decomposeClaimsFromReport(
      "Deployment ready after migration rollback check. CSV row-count and dry-run prove the data is ready. Updated tsconfig and policy approval is recorded."
    );

    expect(claims).toEqual([
      {
        claimType: "data",
        claim: "Data correctness or publish readiness claim.",
        hardClaim: true
      },
      {
        claimType: "release_deploy",
        claim: "Release/deploy readiness claim.",
        hardClaim: true
      },
      {
        claimType: "config_policy",
        claim: "Config/policy claim.",
        hardClaim: true
      },
      {
        claimType: "migration",
        claim: "Migration claim.",
        hardClaim: true
      }
    ]);
  });
});
