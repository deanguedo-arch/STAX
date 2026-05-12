import fs from "node:fs/promises";
import path from "node:path";
import {
  ClaimDecompositionFixtureFileSchema,
  ClaimProofFixtureFileSchema,
  ClaimProofMappingInputSchema,
  type ClaimDecompositionFixtureCase,
  type ClaimDecompositionItem,
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
  eval: ["eval_command_evidence"],
  visual: ["rendered_visual_proof"],
  data: ["data_validation", "row_count_diff", "dry_run_artifact"],
  release_deploy: ["build_proof", "command_evidence_after_diff", "target_environment_proof", "rollback_plan"],
  memory_promotion: ["human_approval", "source_run_reference"],
  security: ["security_test", "secret_scan"],
  config_policy: ["config_diff", "human_policy_approval"],
  dependency: ["dependency_inspection", "dependency_build_proof"],
  migration: ["migration_diff", "migration_apply_proof", "migration_rollback_proof"],
  protocol_compliance: ["protocol_acknowledgement", "codex_report_contract"],
  performance: ["performance_benchmark", "performance_baseline"],
  accessibility: ["accessibility_audit", "ui_flow_evidence"]
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
  const files = (await fs.readdir(fixtureDir))
    .filter((file) => file.endsWith(".json"))
    .filter((file) => !file.includes("decomposition_v2_cases"))
    .sort();
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

export async function loadClaimDecompositionFixtureCases(rootDir = process.cwd()): Promise<ClaimDecompositionFixtureCase[]> {
  const fixturePath = path.join(rootDir, "fixtures", "claim_proof_mapping", "claim_decomposition_v2_cases.json");
  const raw = JSON.parse(await fs.readFile(fixturePath, "utf8")) as unknown;
  return ClaimDecompositionFixtureFileSchema.parse(raw).cases;
}

export function decomposeClaimsFromReport(text: string): ClaimDecompositionItem[] {
  const claims: ClaimDecompositionItem[] = [];
  const normalized = text.trim();
  const prose = stripCommandTokens(normalized);
  const push = (claimType: ClaimProofClaimType, claim: string, hardClaim = true) => {
    if (!claims.some((item) => item.claimType === claimType && item.claim === claim)) {
      claims.push({ claimType, claim, hardClaim });
    }
  };

  if (/\bimplemented\b|\bimplementation is complete\b|\bcompleted\b|\bfix is complete\b|\bdone\b|\ball set\b|\bresolved\b|\bcleaned up\b/i.test(prose)) {
    push("implementation", "Implementation is complete.");
  }
  if (/\btests? passed\b|\btest suite passed\b|\badded tests\b|\bchecks? (?:are )?green\b|\bci (?:is )?green\b|\bbuild passed\b|\btypecheck passed\b|\blint passed\b|\bvalidated\b/i.test(prose)) {
    push("test", "Tests passed.");
  }
  if (/\bevals? passed\b|\bregression passed\b|\bredteam passed\b/i.test(prose)) {
    push("eval", "Evals passed.");
  }
  if (/\bworks\b|\bworks now\b|\bshould work\b|\bbehavior\b|\bfeature works\b|\bbehavior is verified\b|\bruntime ready\b|\bready to use\b/i.test(prose)) {
    push("behavior", "Behavior is proven.");
  }
  if (/\bvisual\b|\blayout\b|\bscreenshot\b|\brendered\b|\bcss\b|\blooks good\b|\blooks correct\b/i.test(prose)) {
    push("visual", "Visual/layout claim.");
  }
  if (/\bdata\b|\bcsv\b|\brow-count\b|\brow count\b|\bdry-run\b|\bdry run\b|\bcanonical\b|\brecords? (?:are )?(?:normalized|clean|valid|ready)\b|\bgenerated rows\b|\brows are clean\b/i.test(prose)) {
    push("data", "Data correctness or publish readiness claim.");
  }
  if (/\brelease\b|\bdeploy(?:ment)?\b|\bpublish\b|\bsync\b|\bapp store\b|\btestflight\b|\bready to ship\b|\bship it\b|\bmergeable\b|\bready to merge\b/i.test(prose)) {
    push("release_deploy", "Release/deploy readiness claim.");
  }
  if (/\bmemory\b|\bpromotion\b|\bpromoted\b|\bpromote\b|\bapproved memory\b|\bapproval exists\b/i.test(prose)) {
    push("memory_promotion", "Memory promotion or approval claim.");
  }
  if (/\bsecurity\b|\bsecret\b|\btoken\b|\bprivate key\b|\bvulnerability\b|\bxss\b|\bcsrf\b|\bauth bypass\b|\binjection\b/i.test(prose)) {
    push("security", "Security claim.");
  }
  if (/\bconfig\b|(?<![-:])\bpolicy\b|\btsconfig\b|\beslint\b|\bplaywright\.config\b/i.test(prose)) {
    push("config_policy", "Config/policy claim.");
  }
  if (/\bdependency\b|\bpackage-lock\b|\byarn\.lock\b|\bpnpm-lock\b|\bupgraded\b|\bupgrade\b|\binstalled\b|\bpackage install\b|\blibrary upgrade\b/i.test(prose)) {
    push("dependency", "Dependency claim.");
  }
  if (/\bmigration\b|\bmigrated\b|\brollback\b|\bdowngrade\b|\bschema change\b|\bdb schema\b|\bdatabase change\b|\balembic\b/i.test(prose)) {
    push("migration", "Migration claim.");
  }
  if (/\bprotocol\b|\bturn contract\b|\bstax_ack\b|\backnowledg(?:e|ed|ement)\b|\bcodex report contract\b|\bfollowed the workflow\b|\bcurrent turn\b|\bsidecar heartbeat\b/i.test(prose)) {
    push("protocol_compliance", "Protocol compliance claim.");
  }
  if (/\bperformance\b|\bfaster\b|\blatency\b|\bbenchmark\b/i.test(prose)) {
    push("performance", "Performance claim.");
  }
  if (/\baccessibility\b|\baxe\b|\ba11y\b|\bscreen reader\b/i.test(prose)) {
    push("accessibility", "Accessibility claim.");
  }

  return claims;
}

function stripCommandTokens(text: string): string {
  return text
    .replace(/`(?:npm|pnpm|yarn|npx)[^`]+`/gi, " ")
    .replace(/\b(?:npm|pnpm|yarn|npx)\s+(?:run\s+)?[a-z0-9:_@./-]+(?:\s+[a-z0-9:_@./=-]+)*/gi, " ");
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
