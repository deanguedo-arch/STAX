import { describe, expect, it } from "vitest";
import {
  findRepoArchetype,
  findRepoCandidate,
  findRepoCandidateInText,
  guidanceForRepoTransfer,
  listRepoArchetypes,
  listRepoCandidates
} from "../src/repoTransfer/RepoTransferRegistry.js";

describe("repo transfer registry", () => {
  it("keeps candidate repos aligned with known archetypes", () => {
    const archetypes = listRepoArchetypes();
    const candidates = listRepoCandidates();

    expect(archetypes).toHaveLength(12);
    expect(candidates).toHaveLength(12);

    for (const candidate of candidates) {
      expect(findRepoArchetype(candidate.archetype)?.archetype).toBe(candidate.archetype);
      expect(guidanceForRepoTransfer({ repoFullName: candidate.repoFullName })?.recommendedFirstBoundedAuditTask).toBe(
        candidate.recommendedFirstBoundedAuditTask
      );
    }
  });

  it("finds candidate repos from freeform text and returns reusable runtime guidance", () => {
    const candidate = findRepoCandidateInText(
      "Repo transfer trial case for storybookjs/storybook with only public repo name and archetype supplied."
    );

    expect(candidate?.repoFullName).toBe("storybookjs/storybook");
    const guidance = guidanceForRepoTransfer({ repoFullName: candidate?.repoFullName });
    expect(guidance?.archetype).toBe("ui_visual_system");
    expect(guidance?.proofGates).toContain("build");
    expect(guidance?.dangerousActions).toContain("publish");
    expect(guidance?.highRiskPatterns).toContain("G1");
  });

  it("looks up a candidate directly by repo name", () => {
    const candidate = findRepoCandidate("dbt-labs/dbt-core");
    expect(candidate?.archetype).toBe("data_pipeline");
  });
});
