import fs from "node:fs/promises";
import path from "node:path";
import {
  ClaimProofFixtureFileSchema,
  ClaimProofMappingInputSchema,
  type ClaimProofClaimType,
  type ClaimProofFixtureCase,
  type ClaimProofMappingInput,
  type ClaimProofMappingResult,
  type ClaimProofType
} from "./ClaimProofMappingSchemas.js";

const REQUIRED_PROOF_BY_CLAIM: Record<ClaimProofClaimType, ClaimProofType[]> = {
  implementation: ["source_diff", "behavior_test", "command_evidence_after_diff"],
  test: ["test_diff", "command_evidence_after_diff"],
  behavior: ["behavior_test", "command_evidence_after_diff"],
  visual: ["rendered_visual_proof"],
  data: ["data_validation", "row_count_diff", "dry_run_artifact"],
  release_deploy: ["build_proof", "command_evidence_after_diff", "target_environment_proof", "rollback_plan"],
  memory_promotion: ["human_approval", "source_run_reference"],
  security: ["security_test", "secret_scan"]
};

export function requiredProofForClaim(claimType: ClaimProofClaimType): ClaimProofType[] {
  return [...REQUIRED_PROOF_BY_CLAIM[claimType]];
}

export function mapClaimToProof(input: ClaimProofMappingInput): ClaimProofMappingResult {
  const parsed = ClaimProofMappingInputSchema.parse(input);
  const requiredProof = requiredProofForClaim(parsed.claimType);
  const proofByType = new Map(parsed.suppliedProof.map((proof) => [proof.proofType, proof.strength]));
  const missingProof = requiredProof.filter((proofType) => !proofByType.has(proofType) || proofByType.get(proofType) === "missing");
  const weakProof = requiredProof.filter((proofType) => proofByType.get(proofType) === "weak");
  const unsupported = missingProof.length > 0 || weakProof.length > 0;
  const verdict = unsupported
    ? parsed.hardClaim
      ? "reject"
      : "provisional"
    : "accept";

  return {
    verdict,
    requiredProof,
    missingProof,
    weakProof,
    unsupportedHardClaim: parsed.hardClaim && unsupported,
    explanation: renderExplanation(parsed.claimType, verdict, missingProof, weakProof)
  };
}

export async function loadClaimProofFixtureCases(rootDir = process.cwd()): Promise<ClaimProofFixtureCase[]> {
  const fixtureDir = path.join(rootDir, "fixtures", "claim_proof_mapping");
  const files = (await fs.readdir(fixtureDir)).filter((file) => file.endsWith(".json")).sort();
  const expanded: ClaimProofFixtureCase[] = [];
  for (const filename of files) {
    const raw = JSON.parse(await fs.readFile(path.join(fixtureDir, filename), "utf8")) as unknown;
    const parsed = ClaimProofFixtureFileSchema.parse(raw);
    for (const testCase of parsed.cases) {
      for (let index = 0; index < testCase.repeat; index += 1) {
        expanded.push({
          ...testCase,
          caseId: testCase.repeat === 1 ? testCase.caseId : `${testCase.caseId}_${index + 1}`,
          repeat: 1
        });
      }
    }
  }
  return expanded;
}

function renderExplanation(
  claimType: ClaimProofClaimType,
  verdict: ClaimProofMappingResult["verdict"],
  missingProof: ClaimProofType[],
  weakProof: ClaimProofType[]
): string {
  if (verdict === "accept") return `${claimType} claim has the required strong proof.`;
  const gaps = [...missingProof.map((item) => `missing ${item}`), ...weakProof.map((item) => `weak ${item}`)];
  return `${claimType} claim is not hard-proven: ${gaps.join(", ")}.`;
}
