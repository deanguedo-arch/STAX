import { describe, expect, it } from "vitest";
import {
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
  });

  it("expands fixture templates into 100 claim/proof pairs", async () => {
    const cases = await loadClaimProofFixtureCases();
    expect(cases).toHaveLength(100);
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
});
