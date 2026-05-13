import type { ProofSurfacePack } from "./ProofSurfacePackSchemas.js";

export function renderProofSurfaceReviewPacket(pack: ProofSurfacePack): string {
  return [
    "## Repo Proof Surface Candidate",
    "",
    `Repo: ${pack.repoName ?? "unknown"}`,
    `Confidence: ${pack.confidence}`,
    `Status: ${pack.status}`,
    "",
    "## Detected Stack",
    ...bullets(pack.detectedStack, "No stack signals detected."),
    "",
    "## Detected Proof Commands",
    ...bullets(unique(pack.proofSurfaces.flatMap((surface) => surface.commands)), "No proof commands detected."),
    "",
    "## Detected Risky Actions",
    ...bullets(pack.blockedActions.map((action) => `${action.action} requires ${action.requires.join(", ")}`), "No risky live actions detected."),
    "",
    "## Proposed Proof Rules",
    ...pack.proofSurfaces.map((surface) => `- ${surface.claimType}: require ${surface.requiredEvidence.join(", ") || "evidence"} (${surface.source})`),
    "",
    "## Unknowns",
    ...bullets(pack.warnings, "No unknowns recorded."),
    "",
    "## Decision Needed",
    "Approve this proof surface, edit it, or keep it candidate-only.",
    ""
  ].join("\n");
}

function bullets(items: string[], empty: string): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : [`- ${empty}`];
}

function unique(items: string[]): string[] {
  return [...new Set(items)].sort();
}
