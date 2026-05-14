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
  const prose = normalizeClaimProse(normalized);
  const sourceQualified = isSourceQualifiedClaim(prose);
  const hardClaimFor = (claimType: ClaimProofClaimType) => !(sourceQualified && claimType === "test");
  const push = (claimType: ClaimProofClaimType, claim: string, hardClaim = true) => {
    if (!claims.some((item) => item.claimType === claimType && item.claim === claim)) {
      claims.push({ claimType, claim, hardClaim });
    }
  };

  const visualScopedCompletion = /\b(?:visual|layout|css|screenshot|rendered|style|ui)\b.{0,60}\b(?:done|complete|completed|resolved|fixed)\b|\b(?:done|complete|completed|resolved|fixed)\b.{0,60}\b(?:visual|layout|css|screenshot|rendered|style|ui)\b/i.test(prose);
  const domainScopedPlainFix = /\b(?:visual|layout|css|screenshot|rendered|style|ui|security|secret|token|private key|vulnerability|xss|csrf|auth bypass|injection|policy|config)\b.{0,60}\bfixed\b|\bfixed\b.{0,60}\b(?:visual|layout|css|screenshot|rendered|style|ui|security|secret|token|private key|vulnerability|xss|csrf|auth bypass|injection|policy|config)\b/i.test(prose);
  if (
    (/\bimplemented\b|\b(?:implementation|fix|work|changes?) (?:is|are) complete\b|\bcompleted\b|\bdone\b|\ball set\b|\bresolved\b|\bcleaned up\b/i.test(prose) && !visualScopedCompletion) ||
    (/\bfixed\b/i.test(prose) && !domainScopedPlainFix)
  ) {
    push("implementation", "Implementation is complete.", hardClaimFor("implementation"));
  }
  const dataScopedValidation = /\b(?:csv|data|records?|rows?|canonical dataset|data mapping)\b.{0,60}\bvalidated\b|\bvalidated\b.{0,60}\b(?:csv|data|records?|rows?|canonical dataset|data mapping)\b/i.test(prose);
  if (/\btests? passed\b|\btest suite passed\b|\badded tests\b|\bchecks? (?:are )?green\b|\bci (?:is )?green\b|\bbuild passed\b|\btypecheck passed\b|\blint passed\b|\bvalidated\b/i.test(prose) && !dataScopedValidation) {
    push("test", "Tests passed.", hardClaimFor("test"));
  }
  if (/\bevals? passed\b|\bregression passed\b|\bredteam passed\b/i.test(prose)) {
    push("eval", "Evals passed.", hardClaimFor("eval"));
  }
  if (/\bworks\b|\bworks now\b|\bshould work\b|\bbehavior\b|\bfeature works\b|\bbehavior is verified\b|\bruntime ready\b|\bready to use\b/i.test(prose)) {
    push("behavior", "Behavior is proven.", hardClaimFor("behavior"));
  }
  if (/\bvisual\b|\blayout\b|\bscreenshot\b|\brendered\b|\bcss\b|\blooks good\b|\blooks correct\b/i.test(prose)) {
    push("visual", "Visual/layout claim.", hardClaimFor("visual"));
  }
  if (/\b(?:csv|data|records?|rows?|canonical dataset|data mapping)\b.{0,80}\b(?:ready|readiness|valid|validated|clean|normalized|proved|proven|prepared|correct|row-count|row count|dry-run|dry run|generated)\b|\b(?:row-count|row count|dry-run|dry run|generated rows|rows are clean)\b/i.test(prose)) {
    push("data", "Data correctness or publish readiness claim.", hardClaimFor("data"));
  }
  if (/\b(?:release|deploy(?:ment)?|publish|sync|app store|testflight|data\s+publish)\b.{0,80}\b(?:ready|readiness|candidate|done|complete|succeeded|passed|verified|published|deployed|synced|shipped|mergeable|safe|can proceed|proceed)\b|\bready to (?:publish|deploy|release|sync|ship|merge)\b|\b(?:published|deployed|synced|released)\b|\bready to ship\b|\bship it\b|\bmergeable\b|\bready to merge\b/i.test(prose)) {
    push("release_deploy", "Release/deploy readiness claim.", hardClaimFor("release_deploy"));
  }
  if (
    /\bmemory\b.{0,80}\b(?:approved|approval|promot(?:e|ed|ion)?|written|write|durable|update|ready)\b|\b(?:approved|approval|promot(?:e|ed|ion)?|durable|candidate can become)\b.{0,80}\bmemory\b|\bpromotion is ready\b|\blearning should be promoted\b|\bpromote the source run\b|\bapproval exists\b/i.test(prose)
  ) {
    push("memory_promotion", "Memory promotion or approval claim.", hardClaimFor("memory_promotion"));
  }
  if (/\bsecurity\b|\bsecret\b|\btoken\b|\bprivate key\b|\bvulnerability\b|\bxss\b|\bcsrf\b|\bauth bypass\b|\binjection\b/i.test(prose)) {
    push("security", "Security claim.", hardClaimFor("security"));
  }
  if (/\b(?:config-heavy|config-only|workflow-only)\b|\b(?:updated|changed|added|modified|set|recorded|approved|approval|proves?|ready|readiness)\b.{0,80}\b(?:config|policy|tsconfig|eslint|playwright\.config)\b|\b(?:config|policy|tsconfig|eslint|playwright\.config)\b.{0,80}\b(?:updated|changed|added|modified|approval|approved|recorded|proves?|ready|readiness)\b/i.test(prose)) {
    push("config_policy", "Config/policy claim.", hardClaimFor("config_policy"));
  }
  if (/\bdependenc(?:y|ies)\b|\bpackage-lock\b|\byarn\.lock\b|\bpnpm-lock\b|\b(?:dependenc(?:y|ies)|package|library)\b.{0,80}\b(?:upgraded|upgrade|updated|installed|install|safe|ready|complete|clean)\b|\b(?:upgraded|upgrade|updated|installed|install)\b.{0,80}\b(?:dependenc(?:y|ies)|package|library)\b/i.test(prose)) {
    push("dependency", "Dependency claim.", hardClaimFor("dependency"));
  }
  if (/\bmigration\b|\bmigrated\b|\brollback\b|\bdowngrade\b|\bschema change\b|\bdb schema\b|\bdatabase change\b|\balembic\b/i.test(prose)) {
    push("migration", "Migration claim.", hardClaimFor("migration"));
  }
  if (/\bprotocol\b|\bturn contract\b|\bstax_ack\b|\backnowledg(?:e|ed|ement)\b|\bcodex report contract\b|\bfollowed the workflow\b|\bcurrent turn\b|\bsidecar heartbeat\b/i.test(prose)) {
    push("protocol_compliance", "Protocol compliance claim.", hardClaimFor("protocol_compliance"));
  }
  if (/\bperformance\b|\bfaster\b|\blatency\b|\bbenchmark\b/i.test(prose)) {
    push("performance", "Performance claim.", hardClaimFor("performance"));
  }
  if (/\baccessibility\b|\baxe\b|\ba11y\b|\bscreen reader\b/i.test(prose)) {
    push("accessibility", "Accessibility claim.", hardClaimFor("accessibility"));
  }

  return claims;
}

function normalizeClaimProse(text: string): string {
  return stripNegatedClaimLines(stripCommandTokens(stripCodeAndPathTokens(stripNonClaimPrefixedLines(stripReportMetadataSections(stripGeneratedStaxBlocks(text))))));
}

function stripGeneratedStaxBlocks(text: string): string {
  return text.replace(/<!-- STAX:proof-strength:start -->[\s\S]*?<!-- STAX:proof-strength:end -->/g, " ");
}

function stripCodeAndPathTokens(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\b[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)+\b/gi, " ");
}

function stripReportMetadataSections(text: string): string {
  const skippedSections = new Set([
    "files changed",
    "tests added",
    "commands run",
    "command output summary with exit codes",
    "what is unverified",
    "risks",
    "one next action"
  ]);
  const output: string[] = [];
  let skipping = false;

  for (const line of text.split(/\r?\n/)) {
    const heading = parseReportHeading(line);
    if (heading) {
      skipping = skippedSections.has(heading);
      if (!skipping) output.push(line);
      continue;
    }
    if (!skipping) output.push(line);
  }

  return output.join("\n");
}

function parseReportHeading(line: string): string | undefined {
  const normalized = line.trim().replace(/^#+\s*/, "").replace(/\s*:\s*$/, "").toLowerCase();
  if (!normalized || normalized.length > 80) return undefined;
  if (!/^[a-z][a-z0-9 /-]*$/.test(normalized)) return undefined;
  if (!line.trim().endsWith(":")) return undefined;
  return normalized;
}

function stripNegatedClaimLines(text: string): string {
  return text
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/\b(?:does not|do not|did not|not claim|not asserting|no claim|without claiming|not authorized|without enabling|not enabled|not ready|not complete|none (?:was|were) promoted|no .* promoted|not promoted|instead of triggering|before any durable promotion)\b/i.test(line)
    )
    .join("\n");
}

function stripCommandTokens(text: string): string {
  return text
    .replace(/`(?:npm|pnpm|yarn|npx)[^`]+`/gi, " ")
    .replace(/\b(?:npm|pnpm|yarn|npx)[ \t]+(?:run[ \t]+)?[a-z0-9:_@./-]+(?:[ \t]+[a-z0-9:_@./=-]+)*/gi, " ");
}

function stripNonClaimPrefixedLines(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*-?\s*(?:risk|risks|unverified|weak|weak\/provisional|missing proof|primary limiter|next proof action)\s*:/i.test(line))
    .join("\n");
}

function isSourceQualifiedClaim(text: string): boolean {
  return /\b(?:codex|ai|assistant|model|report)\s+(?:says|said|claims?|claimed|reported|states|stated)\b/i.test(text);
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
