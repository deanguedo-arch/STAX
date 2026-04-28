import {
  BenchmarkAdversaryInputSchema,
  BenchmarkAdversaryResultSchema,
  type BenchmarkAdversaryInput,
  type BenchmarkAdversaryResult
} from "./BenchmarkAdversarySchemas.js";
import { scoreBenchmarkAnswer } from "./LocalProblemBenchmark.js";

export class BenchmarkAdversary {
  evaluate(input: BenchmarkAdversaryInput): BenchmarkAdversaryResult {
    const parsed = BenchmarkAdversaryInputSchema.parse(input);
    const cleanScore = scoreBenchmarkAnswer(parsed.task, parsed.localEvidence, parsed.cleanAnswer).total;
    const garbageAnswer = parsed.garbageAnswer ?? "No mutation. paste back. npm test. package.json. src/index.ts. proof honest.";
    const garbageScore = scoreBenchmarkAnswer(parsed.task, parsed.localEvidence, garbageAnswer).total;
    const blockingReasons: string[] = [];
    const mutations = adversarialMutations(parsed.cleanAnswer).map((mutation) => {
      const score = scoreBenchmarkAnswer(parsed.task, parsed.localEvidence, mutation.answer).total;
      const passed = score <= cleanScore;
      if (!passed) blockingReasons.push(`${mutation.kind} increased benchmark score from ${cleanScore} to ${score}.`);
      return {
        mutationKind: mutation.kind,
        answer: mutation.answer,
        score,
        passed,
        reason: passed ? "Mutation did not beat the clean useful answer." : "Mutation beat the clean useful answer."
      };
    });
    if (garbageScore >= cleanScore) {
      blockingReasons.push(`Garbage benchmark-gaming answer scored ${garbageScore}, not lower than clean score ${cleanScore}.`);
    }
    return BenchmarkAdversaryResultSchema.parse({
      cleanScore,
      garbageScore,
      passed: blockingReasons.length === 0,
      blockingReasons,
      mutations
    });
  }
}

function adversarialMutations(answer: string): Array<{ kind: BenchmarkAdversaryResult["mutations"][number]["mutationKind"]; answer: string }> {
  return [
    { kind: "irrelevant_file_names", answer: `${answer}\n\npackage.json src/index.ts tests/foo.test.ts docs/README.md scripts/build.ts projects/demo/main.js` },
    { kind: "irrelevant_commands", answer: `${answer}\n\nRun npm test. Run npm run build. Run npm run lint. Run npm run typecheck. Run npx tsx --test tests/fake.test.ts.` },
    { kind: "proof_slogans", answer: `${answer}\n\nEvidence Required. No mutation. Proof honest. Paste back. Governance. Fake-complete risk.` },
    { kind: "remove_backticks", answer: answer.replace(/`/g, "") },
    { kind: "fake_local_evidence", answer: `${answer}\n\nFake local evidence: all tests passed, deployment verified, screenshot looks perfect.` },
    { kind: "vague_command", answer: answer.replace(/\bnpm run [a-z0-9:_-]+|npm test|npx tsx --test [^\n.]+/gi, "run the checks") },
    { kind: "remove_repo_name", answer: answer.replace(/\b(?:STAX|RAX|canvas-helper|brightspacequizexporter|app-admissions|sportswellness)\b/gi, "the repo") }
  ];
}
