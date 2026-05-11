import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  decomposeClaimsFromReport,
  mapClaimToProof
} from "../claims/ClaimProofMapping.js";
import {
  ClaimDecompositionItemSchema,
  ClaimProofItemSchema,
  ClaimProofVerdictSchema,
  type ClaimDecompositionItem,
  type ClaimProofItem,
  type ClaimProofVerdict
} from "../claims/ClaimProofMappingSchemas.js";

const StaxTrialCategorySchema = z.enum([
  "fake_complete",
  "stale_evidence",
  "forged_evidence",
  "wrong_repo",
  "wrong_branch",
  "ignored_relevant_file",
  "visual_claim_no_visual_proof",
  "release_claim_no_release_proof",
  "human_review_missing_approval",
  "vague_claim_evasion",
  "supported_control"
]);

const StaxTrialCaseSchema = z.object({
  caseId: z.string().min(1),
  category: StaxTrialCategorySchema,
  description: z.string().min(1),
  repeat: z.number().int().positive().default(1),
  report: z.string().min(1),
  expectedClaims: z.array(ClaimDecompositionItemSchema).min(1),
  primaryClaim: ClaimDecompositionItemSchema,
  suppliedProof: z.array(ClaimProofItemSchema).default([]),
  expectedVerdict: ClaimProofVerdictSchema,
  shouldAccept: z.boolean(),
  expectedProofGap: z.array(z.string().min(1)).default([]),
  expectedReason: z.string().min(1),
  expectedNextPrompt: z.string().min(1)
});

const StaxTrialLeagueSchema = z.object({
  fixtureSet: z.string().min(1),
  phase: z.string().min(1),
  thresholds: z.object({
    expandedCases: z.number().int().positive(),
    criticalFalseAccepts: z.number().int().nonnegative(),
    maxFalseRejectRate: z.number().min(0).max(1),
    minNextPromptActionableRate: z.number().min(0).max(1)
  }),
  cases: z.array(StaxTrialCaseSchema).min(1)
});

export type StaxTrialCategory = z.infer<typeof StaxTrialCategorySchema>;
export type StaxTrialCase = z.infer<typeof StaxTrialCaseSchema>;
export type StaxTrialLeague = z.infer<typeof StaxTrialLeagueSchema>;

export type ExpandedStaxTrialCase = StaxTrialCase & {
  templateCaseId: string;
};

export type StaxTrialEvaluation = {
  caseId: string;
  category: StaxTrialCategory;
  expectedVerdict: ClaimProofVerdict;
  actualVerdict: ClaimProofVerdict;
  shouldAccept: boolean;
  falseAccept: boolean;
  falseReject: boolean;
  detectedClaims: ClaimDecompositionItem[];
  missingExpectedClaims: ClaimDecompositionItem[];
  missingProof: string[];
  weakProof: string[];
  nextPromptActionable: boolean;
};

export type StaxTrialLeagueResult = {
  fixtureSet: string;
  expandedCases: number;
  criticalFalseAccepts: number;
  falseRejects: number;
  falseRejectRate: number;
  nextPromptActionableRate: number;
  passed: boolean;
  failures: string[];
  evaluations: StaxTrialEvaluation[];
};

export type StaxTrialResultsArtifact = Omit<StaxTrialLeagueResult, "evaluations" | "failures"> & {
  generatedFrom: string;
  generatedAt: string;
  failures: string[];
  notes: string[];
};

export async function loadStaxTrialLeague(rootDir = process.cwd()): Promise<StaxTrialLeague> {
  const fixturePath = path.join(rootDir, "fixtures", "stax_trials", "manifest.json");
  const raw = JSON.parse(await fs.readFile(fixturePath, "utf8")) as unknown;
  return StaxTrialLeagueSchema.parse(raw);
}

export function expandStaxTrialCases(league: StaxTrialLeague): ExpandedStaxTrialCase[] {
  return league.cases.flatMap((testCase) =>
    Array.from({ length: testCase.repeat }, (_, index) => ({
      ...testCase,
      templateCaseId: testCase.caseId,
      caseId: testCase.repeat === 1 ? testCase.caseId : `${testCase.caseId}_${index + 1}`,
      repeat: 1
    }))
  );
}

export function evaluateStaxTrialCase(testCase: ExpandedStaxTrialCase): StaxTrialEvaluation {
  const detectedClaims = decomposeClaimsFromReport(testCase.report);
  const mapping = mapClaimToProof({
    claimType: testCase.primaryClaim.claimType,
    claim: testCase.primaryClaim.claim,
    hardClaim: testCase.primaryClaim.hardClaim,
    suppliedProof: testCase.suppliedProof
  });
  const missingExpectedClaims = testCase.expectedClaims.filter(
    (expected) => !detectedClaims.some((actual) => sameClaim(actual, expected))
  );
  const falseAccept = !testCase.shouldAccept && mapping.verdict === "accept";
  const falseReject = testCase.shouldAccept && mapping.verdict !== "accept";

  return {
    caseId: testCase.caseId,
    category: testCase.category,
    expectedVerdict: testCase.expectedVerdict,
    actualVerdict: mapping.verdict,
    shouldAccept: testCase.shouldAccept,
    falseAccept,
    falseReject,
    detectedClaims,
    missingExpectedClaims,
    missingProof: mapping.missingProof,
    weakProof: mapping.weakProof,
    nextPromptActionable: isActionableNextPrompt(testCase.expectedNextPrompt)
  };
}

export function evaluateStaxTrialLeague(league: StaxTrialLeague): StaxTrialLeagueResult {
  const cases = expandStaxTrialCases(league);
  const evaluations = cases.map(evaluateStaxTrialCase);
  const failures: string[] = [];
  const criticalFalseAccepts = evaluations.filter((result) => result.falseAccept).length;
  const falseRejects = evaluations.filter((result) => result.falseReject).length;
  const supportedCases = evaluations.filter((result) => result.shouldAccept).length;
  const falseRejectRate = supportedCases === 0 ? 0 : falseRejects / supportedCases;
  const actionableCases = evaluations.filter((result) => result.nextPromptActionable).length;
  const nextPromptActionableRate = actionableCases / evaluations.length;

  if (cases.length !== league.thresholds.expandedCases) {
    failures.push(`Expected ${league.thresholds.expandedCases} expanded cases, got ${cases.length}.`);
  }
  if (criticalFalseAccepts > league.thresholds.criticalFalseAccepts) {
    failures.push(`Critical false accepts: ${criticalFalseAccepts}.`);
  }
  if (falseRejectRate > league.thresholds.maxFalseRejectRate) {
    failures.push(`False reject rate ${falseRejectRate} exceeds ${league.thresholds.maxFalseRejectRate}.`);
  }
  if (nextPromptActionableRate < league.thresholds.minNextPromptActionableRate) {
    failures.push(`Next-prompt actionable rate ${nextPromptActionableRate} is below ${league.thresholds.minNextPromptActionableRate}.`);
  }
  for (const result of evaluations) {
    if (result.actualVerdict !== result.expectedVerdict) {
      failures.push(`${result.caseId}: expected ${result.expectedVerdict}, got ${result.actualVerdict}.`);
    }
    if (result.missingExpectedClaims.length > 0) {
      failures.push(`${result.caseId}: missing expected claims ${result.missingExpectedClaims.map((claim) => claim.claimType).join(", ")}.`);
    }
    const observedProofGaps = new Set([...result.missingProof, ...result.weakProof]);
    const template = cases.find((testCase) => testCase.caseId === result.caseId);
    const missingGaps = template?.expectedProofGap.filter((gap) => !observedProofGaps.has(gap)) ?? [];
    if (missingGaps.length > 0) {
      failures.push(`${result.caseId}: missing expected proof gaps ${missingGaps.join(", ")}.`);
    }
  }

  return {
    fixtureSet: league.fixtureSet,
    expandedCases: cases.length,
    criticalFalseAccepts,
    falseRejects,
    falseRejectRate,
    nextPromptActionableRate,
    passed: failures.length === 0,
    failures,
    evaluations
  };
}

export function buildStaxTrialResultsArtifact(
  result: StaxTrialLeagueResult,
  options: {
    generatedAt: string;
    generatedFrom?: string;
  }
): StaxTrialResultsArtifact {
  return {
    fixtureSet: result.fixtureSet,
    generatedFrom: options.generatedFrom ?? "fixtures/stax_trials/manifest.json",
    generatedAt: options.generatedAt,
    expandedCases: result.expandedCases,
    criticalFalseAccepts: result.criticalFalseAccepts,
    falseRejects: result.falseRejects,
    falseRejectRate: result.falseRejectRate,
    nextPromptActionableRate: result.nextPromptActionableRate,
    passed: result.passed,
    failures: result.failures,
    notes: [
      "Initial Phase 1 league uses 40 adversarial negative cases and 10 supported controls.",
      "This artifact is generated by scripts/staxTrialLeague.ts.",
      "Sidecar end-to-end provenance cases remain covered by tests/sidecarWatchCollect.test.ts."
    ]
  };
}

export function renderStaxTrialFailureReport(result: StaxTrialLeagueResult, generatedAt: string): string {
  const failureLines = result.failures.length > 0
    ? result.failures.map((failure) => `- ${failure}`)
    : ["No failing Phase 1 fixture classes are recorded for this league run."];

  return [
    "# STAX Trial League Failure Report",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Summary",
    "",
    "```txt",
    `Fixture set: ${result.fixtureSet}`,
    `Expanded cases: ${result.expandedCases}`,
    `Critical false accepts: ${result.criticalFalseAccepts}`,
    `False rejects: ${result.falseRejects}`,
    `False reject rate: ${result.falseRejectRate}`,
    `Next prompt actionable rate: ${Math.round(result.nextPromptActionableRate * 100)}%`,
    `Status: ${result.passed ? "Pass" : "Fail"}`,
    "```",
    "",
    "## Failure Classes",
    "",
    ...failureLines,
    "",
    "## Coverage Notes",
    "",
    "The league covers:",
    "",
    "- fake-complete reports",
    "- stale evidence",
    "- forged evidence",
    "- wrong repo evidence",
    "- wrong branch evidence",
    "- ignored relevant file drift",
    "- visual claims without visual proof",
    "- release claims without release proof",
    "- human-review or promotion claims without approval",
    "- vague completion wording evasion",
    "- supported controls for false-reject measurement",
    "",
    "End-to-end sidecar provenance attacks are still exercised by",
    "`tests/sidecarWatchCollect.test.ts`; this fixture league records the controlled",
    "claim/proof expectations and promotion thresholds for Phase 1.",
    ""
  ].join("\n");
}

function sameClaim(actual: ClaimDecompositionItem, expected: ClaimDecompositionItem): boolean {
  return actual.claimType === expected.claimType && actual.claim === expected.claim && actual.hardClaim === expected.hardClaim;
}

function isActionableNextPrompt(prompt: string): boolean {
  return /\b(run|rerun|capture|provide|record|attach|collect|add|supply|update|verify|promote)\b/i.test(prompt)
    && prompt.trim().length >= 24;
}
