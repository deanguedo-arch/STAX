import type { CandidateOutput } from "./CandidateGenerator.js";

export class Reranker {
  rank(candidates: CandidateOutput[]): CandidateOutput[] {
    if (candidates.length <= 1) return candidates;
    return [...candidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }
}
