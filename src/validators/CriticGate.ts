export type CriticReview = {
  pass: boolean;
  issuesFound: string[];
  requiredFixes: string[];
  policyViolations: string[];
  schemaIssues: string[];
  confidence: "low" | "medium" | "high";
};

export class CriticGate {
  pass(review: CriticReview): boolean {
    return review.pass && review.policyViolations.length === 0 && review.schemaIssues.length === 0;
  }
}
