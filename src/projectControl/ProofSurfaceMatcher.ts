import { decomposeClaimsFromReport } from "../claims/ClaimProofMapping.js";
import type { ClaimProofClaimType } from "../claims/ClaimProofMappingSchemas.js";
import type { ProofSurfacePack, ProofSurfaceRule } from "./ProofSurfacePackSchemas.js";

export type ProofSurfaceMatchInput = {
  pack: ProofSurfacePack;
  text: string;
  claimTypes?: ClaimProofClaimType[];
};

export type ProofSurfaceMatch = {
  surface: ProofSurfaceRule;
  score: number;
  reason: string;
  signals: string[];
};

const CLAIM_TYPE_SURFACES: Partial<Record<ClaimProofClaimType, string[]>> = {
  test: ["tests_passed"],
  visual: ["visual_ready", "course_deploy_ready"],
  data: ["ingest_ready", "data_pipeline_ready"],
  release_deploy: ["course_deploy_ready", "publish_sync_deploy_ready", "release_ready"],
  dependency: ["dependency_ready"],
  implementation: ["ingest_ready", "build_ready", "tests_passed"],
  behavior: ["visual_ready", "tests_passed"],
  config_policy: ["publish_sync_deploy_ready", "build_ready"],
  security: ["security_ready"],
  migration: ["migration_ready"],
  protocol_compliance: ["proof_gate_ready"],
  eval: ["proof_gate_ready", "tests_passed"]
};

const SURFACE_KEYWORDS: Record<string, RegExp[]> = {
  repo_identity: [/wrong[-\s]?repo/i, /wrong\s+cwd/i, /repo\s+mismatch/i, /cwd\s+mismatch/i, /target\s+repo/i],
  visual_ready: [/visual/i, /layout/i, /\bcss\b/i, /screenshot/i, /rendered/i, /rendered_visual_proof/i, /\bui\b/i, /looks\s+(?:good|correct)/i],
  course_deploy_ready: [
    /course/i,
    /google[-\s]?hosted/i,
    /firebase/i,
    /hosting/i,
    /live\s+target/i,
    /hosted\s+site/i,
    /external\s+image/i,
    /remote\s+image/i,
    /remote\s+asset/i,
    /placeholder\s+image/i,
    /wikimedia/i,
    /googleusercontent/i,
    /googleapis\.com/i,
    /authoring_unlock/i,
    /forensics?\d*/i,
    /general\s+psychology/i
  ],
  export_ready: [/export/i, /artifact/i, /course[-\s]?shell/i],
  publish_sync_deploy_ready: [/sync/i, /publish/i, /deploy/i, /release/i, /ship/i, /merge/i, /sheets/i, /apps[-\s]?script/i],
  data_pipeline_ready: [/data/i, /pipeline/i, /schema/i, /row/i, /\bcsv\b/i, /\bjson\b/i, /validation/i],
  ingest_ready: [/ingest/i, /parser/i, /seed[-:]?gold/i, /gold/i, /fixture/i, /ingest:ci/i],
  dependency_ready: [/dependenc(?:y|ies)/i, /rollup/i, /package[-\s]?lock/i, /npm\s+ls/i, /\bvite\b/i, /node_modules/i, /install/i],
  gold_fixture_update: [/seed[-:]?gold/i, /update[-:]?gold/i, /snapshot/i, /fixture/i, /expected/i],
  build_ready: [/build/i, /typecheck/i, /compile/i],
  tests_passed: [/\btests?\b/i, /\bpassed\b/i, /\bgreen\b/i, /\bci\b/i, /\bworkflow\b/i, /\bcoverage\b/i],
  proof_gate_ready: [/proof[-\s]?gate/i, /stax\s+gate/i, /sidecar\s+gate/i]
};

const SURFACE_STRONG_PHRASES: Record<string, RegExp[]> = {
  build_ready: [/\bbuild\s+(?:passed|succeeded|green|ready|complete|completed)\b/i, /\btypecheck\s+(?:passed|succeeded|green)\b/i],
  tests_passed: [/\btests?\s+(?:passed|succeeded|green)\b/i, /\btest\s+suite\s+(?:passed|succeeded|green)\b/i],
  publish_sync_deploy_ready: [/\bready\s+to\s+(?:publish|deploy|release|sync|ship|merge)\b/i],
  course_deploy_ready: [/\bcourse\s+(?:deploy|deployment|publish|publication)\b/i, /\bgoogle[-\s]?hosted\s+(?:deploy|export|site)\b/i],
  visual_ready: [/\bvisual\s+(?:pass|passed|ready|verified)\b/i, /\blayout\s+(?:pass|passed|ready|verified)\b/i]
};

const PROOF_GAP_KEYWORDS: Record<string, RegExp[]> = {
  visual_ready: [/visual\s+claim\s+is\s+unsupported/i, /rendered_visual_proof/i, /without\s+rendered\s+visual\s+proof/i],
  course_deploy_ready: [/release_deploy\s+claim\s+is\s+unsupported/i, /target_environment_proof/i, /live\s+target/i, /deploy.*visual/i],
  publish_sync_deploy_ready: [/release_deploy\s+claim\s+is\s+unsupported/i, /rollback_plan/i, /target_environment_proof/i],
  tests_passed: [/test\s+claim\s+is\s+unsupported/i, /test_diff/i],
  build_ready: [/build_proof/i],
  dependency_ready: [/dependency_inspection/i, /dependency_build_proof/i],
  ingest_ready: [/ingest_ci_output/i, /seed[-:]?gold\s+is\s+not\s+repair\s+proof/i],
  repo_identity: [/wrong[-\s]?repo\s+output/i, /wrong\s+commit/i, /wrong\s+worktree/i]
};

export function matchProofSurface(input: ProofSurfaceMatchInput): ProofSurfaceMatch | undefined {
  const text = normalizeText(input.text);
  if (!text) return firstRepoIdentitySurface(input.pack);
  const claimTypes = input.claimTypes ?? decomposeClaimsFromReport(input.text).map((claim) => claim.claimType);
  const scored = input.pack.proofSurfaces
    .map((surface, index) => scoreSurface({ surface, index, text, claimTypes, repoName: input.pack.repoName }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || priorityForSurface(b.surface.claimType) - priorityForSurface(a.surface.claimType));

  if (scored[0]) return scored[0];
  return firstRepoIdentitySurface(input.pack);
}

function scoreSurface(input: {
  surface: ProofSurfaceRule;
  index: number;
  text: string;
  claimTypes: ClaimProofClaimType[];
  repoName?: string;
}): ProofSurfaceMatch {
  const signals: string[] = [];
  let score = 0;

  for (const blockedEvidence of input.surface.blockedEvidence) {
    if (matchesToken(input.text, blockedEvidence)) {
      score += 100;
      signals.push(`blocked evidence matched: ${blockedEvidence}`);
    }
  }

  const matchedCommand = input.surface.commands.find((command) => matchesToken(input.text, command));
  if (matchedCommand) {
    score += 90;
    signals.push(`command matched: ${matchedCommand}`);
  }

  for (const claimType of input.claimTypes) {
    if (CLAIM_TYPE_SURFACES[claimType]?.includes(input.surface.claimType)) {
      score += 60;
      signals.push(`claim type matched: ${claimType}`);
    }
  }

  for (const pattern of PROOF_GAP_KEYWORDS[input.surface.claimType] ?? []) {
    if (pattern.test(input.text)) {
      score += 120;
      signals.push(`proof gap matched: ${pattern.source}`);
      break;
    }
  }

  for (const pattern of SURFACE_STRONG_PHRASES[input.surface.claimType] ?? []) {
    if (pattern.test(input.text)) {
      score += 80;
      signals.push(`strong phrase matched: ${pattern.source}`);
      break;
    }
  }

  for (const pattern of SURFACE_KEYWORDS[input.surface.claimType] ?? []) {
    if (pattern.test(input.text)) {
      score += 40;
      signals.push(`keyword matched: ${pattern.source}`);
      break;
    }
  }

  if (matchesClaimTypeTokens(input.text, input.surface.claimType)) {
    score += 25;
    signals.push(`surface claim type matched: ${input.surface.claimType}`);
  }

  if (input.surface.claimType === "repo_identity" && /wrong|mismatch|target repo|repo root|cwd/i.test(input.text)) {
    score += 80;
    signals.push("repo identity boundary matched");
  }
  if (input.surface.claimType === "repo_identity" && input.repoName && mentionsOtherRepoInsteadOfTarget(input.text, input.repoName)) {
    score += 80;
    signals.push("target repo mismatch language matched");
  }

  return {
    surface: input.surface,
    score,
    reason: signals[0] ?? "no match",
    signals
  };
}

function matchesToken(text: string, rawToken: string): boolean {
  const token = normalizeText(rawToken);
  if (!token) return false;
  const variants = tokenVariants(token);
  return variants.some((variant) => variant.length >= 3 && text.includes(variant));
}

function tokenVariants(token: string): string[] {
  const variants = new Set<string>([token]);
  if (token.startsWith("npm run ")) variants.add(token.slice("npm run ".length));
  if (token.startsWith("npx ")) variants.add(token.slice("npx ".length));
  if (!/\s/.test(token) && token.includes("/")) variants.add(token.replace(/^.*\//, ""));
  return [...variants].filter(Boolean);
}

function matchesClaimTypeTokens(text: string, claimType: string): boolean {
  const tokens = claimType.split("_").filter((token) => token.length > 3 && token !== "ready" && token !== "passed");
  return tokens.length > 0 && tokens.every((token) => text.includes(token));
}

function firstRepoIdentitySurface(pack: ProofSurfacePack): ProofSurfaceMatch | undefined {
  const surface = pack.proofSurfaces.find((candidate) => candidate.claimType === "repo_identity");
  return surface ? { surface, score: 0, reason: "fallback repo identity surface", signals: [] } : undefined;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`"'()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mentionsOtherRepoInsteadOfTarget(text: string, repoName: string): boolean {
  const normalizedRepo = normalizeText(repoName);
  if (!normalizedRepo) return false;
  return /came\s+from|instead\s+of|not\s+from|different\s+repo|other\s+repo/.test(text) && text.includes(normalizedRepo);
}

function priorityForSurface(claimType: string): number {
  if (claimType === "repo_identity") return 100;
  if (claimType === "course_deploy_ready") return 95;
  if (claimType === "ingest_ready" || claimType === "dependency_ready") return 90;
  if (claimType === "publish_sync_deploy_ready" || claimType === "visual_ready") return 80;
  return 0;
}
