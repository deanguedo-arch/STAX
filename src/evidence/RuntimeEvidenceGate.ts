import {
  RuntimeEvidenceInputSchema,
  RuntimeEvidenceResultSchema,
  type RuntimeEvidenceInput,
  type RuntimeEvidenceResult,
  type RuntimeEvidenceStrength
} from "./RuntimeEvidenceSchemas.js";

export class RuntimeEvidenceGate {
  evaluate(input: RuntimeEvidenceInput): RuntimeEvidenceResult {
    const parsed = RuntimeEvidenceInputSchema.parse(input);
    const evidence = parsed.evidence;
    const claim = parsed.claim;
    const failed = hasFailureEvidence(evidence);
    const strength = detectStrength(evidence);
    const reasons: string[] = [];

    if (failed) {
      reasons.push("Failed command evidence overrides vague pass or completion claims.");
      return RuntimeEvidenceResultSchema.parse({
        status: "failed",
        strength,
        verifiedScope: ["Command failure is verified for the supplied output."],
        unverifiedScope: ["Successful runtime/build/test behavior"],
        requiredNextCommand: nextCommandFor(claim, evidence),
        reasons
      });
    }

    if (isLinkedRepoClaimWithOnlyStaxEval(claim, evidence)) {
      reasons.push("STAX eval output cannot verify linked-repo test/build pass claims.");
      return RuntimeEvidenceResultSchema.parse({
        status: "unknown",
        strength: "local_stax_command_evidence",
        verifiedScope: ["STAX eval command output only"],
        unverifiedScope: ["Linked repo runtime/build/test result"],
        requiredNextCommand: nextCommandFor(claim, evidence),
        reasons
      });
    }

    if (strength === "local_stax_command_evidence") {
      reasons.push("Local STAX command evidence can verify STAX-scoped behavior only.");
      return RuntimeEvidenceResultSchema.parse({
        status: "scoped_verified",
        strength,
        verifiedScope: ["STAX-scoped command output"],
        unverifiedScope: ["Linked repo behavior unless that repo command output is supplied"],
        requiredNextCommand: nextCommandFor(claim, evidence),
        reasons
      });
    }

    if (strength === "stored_command_evidence") {
      reasons.push("Stored command evidence supports a scoped runtime claim.");
      return RuntimeEvidenceResultSchema.parse({
        status: "scoped_verified",
        strength,
        verifiedScope: ["Stored command output scope"],
        unverifiedScope: ["Claims outside the stored command output"],
        requiredNextCommand: nextCommandFor(claim, evidence),
        reasons
      });
    }

    if (strength === "pasted_command_output") {
      reasons.push("Human-pasted command output is partial runtime evidence until stored or replayed.");
      return RuntimeEvidenceResultSchema.parse({
        status: "partial",
        strength,
        verifiedScope: ["User-supplied command output"],
        unverifiedScope: ["Stored/replayable command evidence"],
        requiredNextCommand: nextCommandFor(claim, evidence),
        reasons
      });
    }

    if (strength === "script_discovered" || strength === "test_file_discovered" || strength === "source_inspection") {
      reasons.push("Source inspection, discovered scripts, or test files do not prove commands passed.");
      return RuntimeEvidenceResultSchema.parse({
        status: "unknown",
        strength,
        verifiedScope: [scopeForDiscovery(strength)],
        unverifiedScope: ["Runtime/build/test pass or fail result"],
        requiredNextCommand: nextCommandFor(claim, evidence),
        reasons
      });
    }

    reasons.push("No command output or runtime artifact was supplied.");
    return RuntimeEvidenceResultSchema.parse({
      status: "unknown",
      strength: "none",
      verifiedScope: [],
      unverifiedScope: ["Runtime/build/test pass or fail result"],
      requiredNextCommand: nextCommandFor(claim, evidence),
      reasons
    });
  }
}

function detectStrength(evidence: string): RuntimeEvidenceStrength {
  if (/\b(command-evidence|evidence\/commands|stored command evidence|stdoutPath|stderrPath)\b/i.test(evidence)) {
    return "stored_command_evidence";
  }
  if (/\b(npm run rax -- eval|npm run rax -- .*--regression|npm run rax -- .*--redteam|Run:\s*run-|runs\/\d{4}-\d{2}-\d{2}\/run-)\b/i.test(evidence)) {
    return "local_stax_command_evidence";
  }
  if (/(\$\s*)?(npm|pnpm|yarn|npx|python|pytest|vitest)\s+[^\n]+[\s\S]*\b(passed|failed|error|exit code|tests?)\b/i.test(evidence)) {
    return "pasted_command_output";
  }
  if (/\b(package\.json|scripts?:|repo-script:|npm run [a-z0-9:_-]+)\b/i.test(evidence)) {
    return "script_discovered";
  }
  if (/\b(tests?\/|\.test\.[tj]sx?|\.spec\.[tj]sx?|repo-test:)\b/i.test(evidence)) {
    return "test_file_discovered";
  }
  if (/\b(src\/|scripts\/|projects\/|README\.md|diff --git)\b/i.test(evidence)) {
    return "source_inspection";
  }
  return "none";
}

function hasFailureEvidence(evidence: string): boolean {
  return /\b(failed|failure|error:|exit code\s*[1-9]|npm ERR!|AssertionError|TypeError|ReferenceError)\b/i.test(evidence);
}

function isLinkedRepoClaimWithOnlyStaxEval(claim: string, evidence: string): boolean {
  const linkedRepoClaim = /\b(canvas-helper|brightspacequizexporter|course-factory|ADMISSION-APP|studentbudgetwars|linked repo|external repo)\b/i.test(claim);
  const staxEvalEvidence = /\b(npm run rax -- eval|eval --regression|eval --redteam|STAX eval)\b/i.test(evidence);
  return linkedRepoClaim && staxEvalEvidence && !/\b(canvas-helper|brightspacequizexporter|course-factory|ADMISSION-APP|studentbudgetwars).*\b(npm run|pytest|vitest|build|test)\b/i.test(evidence);
}

function scopeForDiscovery(strength: RuntimeEvidenceStrength): string {
  if (strength === "script_discovered") return "Package script exists";
  if (strength === "test_file_discovered") return "Test file exists";
  return "Source files were inspected";
}

function nextCommandFor(claim: string, evidence: string): string | undefined {
  const text = `${claim}\n${evidence}`;
  if (/\btypecheck\b/i.test(text)) return "npm run typecheck";
  if (/\bregression\b/i.test(text)) return "npm run rax -- eval --regression";
  if (/\bredteam\b/i.test(text)) return "npm run rax -- eval --redteam";
  if (/\bbuild:pages\b/i.test(text)) return "npm run build:pages";
  if (/\bbuild\b/i.test(text)) return "npm run build";
  if (/\btest|tests|passed|pass\b/i.test(text)) return "npm test";
  return undefined;
}
