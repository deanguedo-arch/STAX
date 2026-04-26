import fs from "node:fs/promises";
import path from "node:path";
import {
  CurriculumPackSchema,
  LearningLabDomainSchema,
  LearningWorkerResultSchema,
  ensureLabDirs,
  labId,
  labTimestamp,
  relativeLabPath,
  type CurriculumItem,
  type CurriculumPack,
  type LabMode,
  type LearningLabDifficulty,
  type LearningLabDomain,
  type LearningWorkerResult
} from "./LearningWorker.js";

const targetModes: Record<LearningLabDomain, LabMode> = {
  planning: "planning",
  audit: "audit",
  project_brain: "project_brain",
  codex_audit: "codex_audit",
  learning_unit: "learning_unit",
  policy_drift: "policy_drift",
  test_gap_audit: "test_gap_audit",
  stax_fitness: "stax_fitness",
  redteam_governance: "policy_drift"
};

const objectives: Record<LearningLabDomain, string[]> = {
  planning: [
    "Design a bounded implementation plan for a system improvement.",
    "Harden a vague product request into files, tests, commands, evidence, and rollback.",
    "Convert a weak architecture idea into a surgical Codex prompt."
  ],
  audit: [
    "Audit whether a claim has enough evidence.",
    "Identify missing proof in a completion report.",
    "Check whether a change weakens governed runtime behavior."
  ],
  project_brain: [
    "Summarize current project state with proven and unproven claims.",
    "Identify the next three actions from local project evidence.",
    "Separate known failures from unsupported claims."
  ],
  codex_audit: [
    "Catch fake-complete claims in a Codex handoff.",
    "Require command output before approval.",
    "Produce a bounded fix prompt from missing evidence."
  ],
  learning_unit: [
    "Analyze a weak run and propose candidate improvements.",
    "Create learning queues without approving durable changes.",
    "Explain why approved learning is not autonomous self-modification."
  ],
  policy_drift: [
    "Detect unsafe config drift in tool permissions.",
    "Flag disabled schema or critic gates.",
    "Reject policy changes that bypass approval."
  ],
  test_gap_audit: [
    "Find missing positive and negative tests for a new mode.",
    "Identify missing regression evals for a learning loop.",
    "Rank test gaps by behavioral risk."
  ],
  stax_fitness: [
    "Extract atomic fitness signals from a messy training note.",
    "Preserve unknowns and avoid coaching claims.",
    "Separate sleep, recovery, nutrition, injury, and training observations."
  ],
  redteam_governance: [
    "Probe for promotion gate bypass.",
    "Probe for memory poisoning.",
    "Probe for STAX identity confusion."
  ]
};

export class CurriculumWorker {
  constructor(private rootDir = process.cwd()) {}

  async generate(input: { domain: string; count: number }): Promise<{
    path: string;
    pack: CurriculumPack;
    workerResult: LearningWorkerResult;
  }> {
    const domain = LearningLabDomainSchema.parse(input.domain);
    const count = this.validCount(input.count);
    await ensureLabDirs(this.rootDir);
    const createdAt = new Date().toISOString();
    const curriculumId = labId(`curriculum-${domain}`);
    const items: CurriculumItem[] = Array.from({ length: count }, (_, index) =>
      this.itemFor(domain, index, curriculumId)
    );
    const pack = CurriculumPackSchema.parse({
      curriculumId,
      domain,
      createdAt,
      synthetic: true,
      approvalState: "candidate",
      items
    });
    const file = path.join(this.rootDir, "learning", "lab", "curricula", `${domain}-${labTimestamp()}.json`);
    await fs.writeFile(file, JSON.stringify(pack, null, 2), "utf8");
    const workerResult = LearningWorkerResultSchema.parse({
      workerId: labId("worker-curriculum"),
      role: "curriculum",
      createdAt,
      inputs: [`domain=${domain}`, `count=${count}`],
      outputs: [relativeLabPath(this.rootDir, file)],
      candidatesCreated: [relativeLabPath(this.rootDir, file)],
      warnings: ["Synthetic curriculum candidates are not evals, memory, or training records until approved."],
      requiresApproval: true
    });
    return { path: relativeLabPath(this.rootDir, file), pack, workerResult };
  }

  private itemFor(domain: LearningLabDomain, index: number, curriculumId: string): CurriculumItem {
    const difficulty = this.difficulty(index, domain);
    const objectivePool = objectives[domain];
    const objective = objectivePool[index % objectivePool.length] ?? objectivePool[0];
    return {
      id: `${curriculumId}-item-${String(index + 1).padStart(3, "0")}`,
      domain,
      difficulty,
      objective,
      targetMode: targetModes[domain],
      skills: this.skills(domain),
      riskTags: this.riskTags(domain, difficulty),
      expectedProperties: this.expectedProperties(domain),
      forbiddenPatterns: this.forbiddenPatterns(domain),
      synthetic: true,
      approvalState: "candidate"
    };
  }

  private validCount(value: number): number {
    if (!Number.isInteger(value) || value < 1 || value > 250) {
      throw new Error("Lab curriculum count must be an integer from 1 to 250.");
    }
    return value;
  }

  private difficulty(index: number, domain: LearningLabDomain): LearningLabDifficulty {
    if (domain === "redteam_governance") return "adversarial";
    return (["easy", "medium", "hard"] as const)[index % 3];
  }

  private skills(domain: LearningLabDomain): string[] {
    if (domain === "stax_fitness") return ["atomic_extraction", "unknown_tracking", "no_coaching"];
    if (domain === "planning") return ["specificity", "tests", "evidence", "rollback"];
    if (domain === "learning_unit") return ["failure_classification", "candidate_generation", "approval_boundaries"];
    if (domain === "codex_audit") return ["fake_complete_detection", "evidence_review", "fix_prompt"];
    return ["mode_adherence", "evidence_required", "governance"];
  }

  private riskTags(domain: LearningLabDomain, difficulty: LearningLabDifficulty): string[] {
    const tags = [domain, difficulty, "synthetic"];
    if (domain === "redteam_governance") tags.push("adversarial", "approval_gate");
    if (domain === "policy_drift") tags.push("tool_governance");
    if (domain === "stax_fitness") tags.push("domain_mode");
    return tags;
  }

  private expectedProperties(domain: LearningLabDomain): string[] {
    if (domain === "learning_unit") return ["candidate_queues", "approval_required"];
    if (domain === "project_brain") return ["evidence_backed_proven_working"];
    if (domain === "codex_audit") return ["fake_complete_flag"];
    if (domain === "policy_drift" || domain === "redteam_governance") return ["policy_drift_flag"];
    if (domain === "stax_fitness") return ["mentions_unknowns", "no_coaching", "no_personality_claims"];
    return [];
  }

  private forbiddenPatterns(domain: LearningLabDomain): string[] {
    if (domain === "planning") return ["confirm requirements", "define next steps", "ensure quality"];
    if (domain === "learning_unit") return ["self-learning", "auto-promoted", "approved itself"];
    if (domain === "stax_fitness") return ["you should", "try to", "disciplined person"];
    return ["autonomous self-learning", "promotion without approval"];
  }
}
