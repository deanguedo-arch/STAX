import { describe, expect, it } from "vitest";
import {
  buildInvestorBenchmarkCollection,
  type InvestorCaptureEntry
} from "../src/campaign/InvestorProofBenchmark.js";

describe("InvestorProofBenchmark", () => {
  it("builds a benchmark collection with repo-aware local evidence", () => {
    const captures: InvestorCaptureEntry[] = [
      {
        taskId: "investor_brightspace_ingest_005",
        workspace: "brightspacequizexporter",
        category: "build_ingest_gate",
        prompt: "After dependency presence is proven in Brightspace, what exact gate command proves build plus ingest without using seed-gold?",
        staxOutput: "## Verdict\n- bounded",
        chatgptOutput: "## Verdict\n- generic"
      }
    ];

    const collection = buildInvestorBenchmarkCollection(captures);
    expect(collection.id).toBe("investor-proof-10");
    expect(collection.cases).toHaveLength(1);
    expect(collection.cases[0]?.repo).toBe("brightspacequizexporter");
    expect(collection.cases[0]?.localEvidence).toContain("repo-script:build=npm run build");
    expect(collection.cases[0]?.localEvidence).toContain("repo-script:ingestGate=npm run ingest:ci");
  });
});
