import type { StrategicOption } from "./StrategicQuestionSchemas.js";

export class OptionGenerator {
  generate(question: string): StrategicOption[] {
    const lower = question.toLowerCase();
    const staxBroadReasoning = /\b(stax|chatgpt|broad reasoning|strategy|creative|better than)\b/.test(lower);

    if (staxBroadReasoning) {
      return [
        {
          optionId: "strategic_deliberation_v0",
          title: "Build Strategic Deliberation Mode v0",
          description: "Create a governed strategy mode that compares options, rejects alternatives, names opportunity cost, and adds kill criteria.",
          userValue: "high",
          implementationCost: "medium",
          reversibility: "reversible",
          opportunityCost: "Delays broader autonomy work, but improves the quality of the decisions that would drive autonomy.",
          evidenceFor: [
            "Local proof gates improve reliability but do not create broader strategic reasoning.",
            "The user explicitly wants STAX to improve broad product reasoning, creative planning, and ambiguous judgment."
          ],
          evidenceAgainst: [
            "A deterministic strategic template can still become strategy theater.",
            "A weak provider cannot produce frontier-level strategic novelty by schema alone."
          ],
          redTeamFailureModes: [
            "Outputs headings without real tradeoffs.",
            "Selects a fashionable option without rejecting alternatives.",
            "Claims certainty without local or external evidence."
          ],
          proofNeeded: [
            "Run strategy-mode regression evals.",
            "Compare strategic outputs against external ChatGPT on fresh broad-reasoning tasks."
          ],
          killCriteria: [
            "If 3 of 10 strategic outputs are generic or fail to select one option, do not expand the mode."
          ]
        },
        {
          optionId: "strategic_benchmark_first",
          title: "Build Strategic Benchmark v0 First",
          description: "Create broad-reasoning benchmark fixtures before adding a new mode.",
          userValue: "medium",
          implementationCost: "medium",
          reversibility: "reversible",
          opportunityCost: "Measures the gap earlier, but does not improve STAX's strategic output by itself.",
          evidenceFor: [
            "The general superiority gate already shows broad superiority is not proven.",
            "Benchmarks can prevent false victory claims."
          ],
          evidenceAgainst: [
            "Benchmarking first can become another scoreboard without improving the generator.",
            "The user asked for better broad reasoning, not only better measurement."
          ],
          redTeamFailureModes: [
            "Overfits fixtures.",
            "Rewards benchmark phrasing instead of strategic usefulness."
          ],
          proofNeeded: [
            "Fresh strategy tasks and locked STAX answers before external capture."
          ],
          killCriteria: [
            "If the benchmark cannot distinguish generic strategy from decision-quality strategy, pause it."
          ]
        },
        {
          optionId: "autonomous_execution_loop",
          title: "Build More Autonomous Execution",
          description: "Let STAX generate more tasks, patches, and verification loops.",
          userValue: "medium",
          implementationCost: "high",
          reversibility: "costly_to_reverse",
          opportunityCost: "Could automate bad strategic choices before the strategy layer is trustworthy.",
          evidenceFor: [
            "STAX already has learning lab and benchmark scaffolding."
          ],
          evidenceAgainst: [
            "Autonomy does not solve the broad-reasoning weakness.",
            "It increases blast radius before strategic selection is strong."
          ],
          redTeamFailureModes: [
            "Fast execution of the wrong direction.",
            "More proof artifacts without better decisions."
          ],
          proofNeeded: [
            "A strategic decision gate proving it can pick the right work before automating work."
          ],
          killCriteria: [
            "If strategic mode is not passing, do not expand autonomous execution."
          ]
        },
        {
          optionId: "provider_upgrade_only",
          title: "Only Upgrade The Provider",
          description: "Use a stronger reasoning model without changing STAX strategy structure.",
          userValue: "medium",
          implementationCost: "low",
          reversibility: "reversible",
          opportunityCost: "Improves raw reasoning but leaves strategy untestable and easy to overclaim.",
          evidenceFor: [
            "A stronger provider is necessary for frontier-level reasoning."
          ],
          evidenceAgainst: [
            "Provider strength alone does not add option comparison, kill criteria, or proof discipline."
          ],
          redTeamFailureModes: [
            "STAX becomes plain ChatGPT with local wrappers.",
            "Broad answers sound smarter but stay unmeasured."
          ],
          proofNeeded: [
            "Provider capability metadata and external strategic comparisons."
          ],
          killCriteria: [
            "If outputs lack tradeoffs and kill criteria, provider upgrade alone is insufficient."
          ]
        }
      ];
    }

    return [
      {
        optionId: "bounded_decision_pass",
        title: "Run A Bounded Strategic Decision Pass",
        description: "Compare a small set of options and select one reversible next move.",
        userValue: "high",
        implementationCost: "low",
        reversibility: "reversible",
        opportunityCost: "Slower than answering immediately, but reduces vague strategic drift.",
        evidenceFor: ["The question is ambiguous enough to need option comparison."],
        evidenceAgainst: ["The evidence may be too thin for high confidence."],
        redTeamFailureModes: ["May become generic if no evidence is supplied."],
        proofNeeded: ["Capture the next proof step and paste back the result."],
        killCriteria: ["If no concrete decision emerges, ask for missing evidence before continuing."]
      },
      {
        optionId: "collect_more_evidence",
        title: "Collect More Evidence Before Deciding",
        description: "Pause the decision until local or external evidence is available.",
        userValue: "medium",
        implementationCost: "low",
        reversibility: "reversible",
        opportunityCost: "Delays action and may become avoidance.",
        evidenceFor: ["Missing evidence lowers strategic confidence."],
        evidenceAgainst: ["Some decisions need a reversible bet, not endless evidence collection."],
        redTeamFailureModes: ["Turns uncertainty into paralysis."],
        proofNeeded: ["Name the exact missing evidence."],
        killCriteria: ["If the evidence request is vague, reject this option."]
      },
      {
        optionId: "broad_roadmap",
        title: "Write A Broad Roadmap",
        description: "Generate a multi-step roadmap instead of one strategic decision.",
        userValue: "low",
        implementationCost: "medium",
        reversibility: "reversible",
        opportunityCost: "Creates more work without deciding the next best move.",
        evidenceFor: ["Roadmaps can expose dependencies."],
        evidenceAgainst: ["The user needs a selected direction, not a pile of options."],
        redTeamFailureModes: ["Looks impressive but avoids commitment."],
        proofNeeded: ["A single selected next slice."],
        killCriteria: ["If it lists many moves without selecting one, fail it."]
      }
    ];
  }
}
