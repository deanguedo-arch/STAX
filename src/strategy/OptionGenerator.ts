import type { StrategicOption } from "./StrategicQuestionSchemas.js";

export class OptionGenerator {
  generate(question: string): StrategicOption[] {
    const lower = question.toLowerCase();
    const staxBroadReasoning = /\b(stax|chatgpt|broad reasoning|strategy|creative|better than)\b/.test(lower);
    const themed = themedBroadOptions(lower);
    if (themed) return themed;

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

function themedBroadOptions(lower: string): StrategicOption[] | undefined {
  const theme = primaryTheme(lower);
  if (!theme) return undefined;
  return [
    {
      optionId: theme.optionId,
      title: theme.title,
      description: theme.description,
      userValue: "high",
      implementationCost: "medium",
      reversibility: "reversible",
      opportunityCost: theme.opportunityCost,
      evidenceFor: [
        theme.evidenceFor,
        "The user is asking for broad reasoning quality, not only process proof."
      ],
      evidenceAgainst: [
        "A themed control can still become formulaic if it is not benchmarked against fresh external answers."
      ],
      redTeamFailureModes: [
        "Could become a named template rather than real judgment.",
        "Could overfit the current benchmark lane.",
        "Could claim broad superiority before fresh external baselines pass."
      ],
      proofNeeded: [
        theme.proofNeeded,
        "Run the strategic benchmark and inspect any template-collapse or external-baseline failures."
      ],
      killCriteria: [
        theme.killCriteria
      ]
    },
    {
      optionId: "benchmark_only",
      title: "Benchmark Only",
      description: "Measure the issue without changing the strategy generator.",
      userValue: "medium",
      implementationCost: "low",
      reversibility: "reversible",
      opportunityCost: "Improves measurement but does not create better strategic output.",
      evidenceFor: ["Benchmarks prevent false superiority claims."],
      evidenceAgainst: ["A scoreboard alone does not improve option quality."],
      redTeamFailureModes: ["Could become proof theater."],
      proofNeeded: ["A case where benchmark-only changes improve a future answer."],
      killCriteria: ["If benchmark-only changes do not alter behavior, reject this path."]
    },
    {
      optionId: "provider_only",
      title: "Provider Only",
      description: "Use a stronger model without adding a task-specific strategy surface.",
      userValue: "medium",
      implementationCost: "low",
      reversibility: "reversible",
      opportunityCost: "May improve raw reasoning but leaves the decision unstructured and harder to audit.",
      evidenceFor: ["A stronger provider can improve creative synthesis."],
      evidenceAgainst: ["Provider strength alone does not enforce alternatives, tradeoffs, or kill criteria."],
      redTeamFailureModes: ["Could become plain ChatGPT with local wrappers."],
      proofNeeded: ["A before/after provider comparison on frozen tasks."],
      killCriteria: ["If outputs lack rejected alternatives or kill criteria, provider-only is insufficient."]
    },
    {
      optionId: "autonomy_first",
      title: "Autonomy First",
      description: "Automate more work before improving strategic selection.",
      userValue: "low",
      implementationCost: "high",
      reversibility: "costly_to_reverse",
      opportunityCost: "Can scale weak strategy into more weak work.",
      evidenceFor: ["Execution loops already exist in the roadmap."],
      evidenceAgainst: ["Autonomy does not solve the broad-reasoning weakness."],
      redTeamFailureModes: ["Fast execution of the wrong direction."],
      proofNeeded: ["Strategic selection proof before automation."],
      killCriteria: ["If strategic benchmarks are not passing, do not expand autonomy."]
    }
  ];
}

function primaryTheme(lower: string): {
  optionId: string;
  title: string;
  description: string;
  opportunityCost: string;
  evidenceFor: string;
  proofNeeded: string;
  killCriteria: string;
} | undefined {
  if (/\bcreative|novel|original|different options|variants\b/.test(lower)) {
    return {
      optionId: "creative_option_divergence_gate",
      title: "Build A Creative Option Divergence Gate",
      description: "Force broad strategy to generate genuinely different option families before choosing one.",
      opportunityCost: "Delays execution features, but prevents STAX from becoming a single polished strategic template.",
      evidenceFor: "The task is about creative planning or novelty, which fails when every answer uses the same option shape.",
      proofNeeded: "Run a strategy benchmark lane that compares option-family diversity across fresh creative tasks.",
      killCriteria: "If three fresh creative tasks reuse the same best option or same rejected alternatives, stop and patch option generation."
    };
  }
  if (/\bincomplete|unverified|uncertain|weak current evidence|refuses to concede|gaming the benchmark|high-upside\b/.test(lower)) {
    return {
      optionId: "reversible_uncertainty_protocol",
      title: "Build A Reversible Uncertainty Protocol",
      description: "Choose small reversible bets when evidence is incomplete, with explicit stop rules.",
      opportunityCost: "May move slower than a bold call, but reduces false certainty and endless debate.",
      evidenceFor: "The task asks for decision quality under uncertainty rather than pure proof collection.",
      proofNeeded: "Capture an external baseline, freeze the STAX answer, and score whether the chosen bet had better falsification rules.",
      killCriteria: "If uncertainty outputs keep asking for vague evidence instead of naming a reversible bet, stop and patch the mode."
    };
  }
  if (/\bcross-domain|combine|across canvas|without overfitting|software repo|course-design|non-code|borrow behavior\b/.test(lower)) {
    return {
      optionId: "domain_lens_matrix",
      title: "Build A Domain Lens Matrix",
      description: "Evaluate strategy through separate domain lenses before selecting the transferable pattern.",
      opportunityCost: "Adds deliberation time, but avoids flattening code, teaching, product, and creative tasks into one command rubric.",
      evidenceFor: "The task requires transfer across unlike domains, where one universal rubric can hide important differences.",
      proofNeeded: "Run holdout tasks from at least five domains and check whether the selected proof type changes by domain.",
      killCriteria: "If cross-domain answers name the same proof type for unlike domains in three cases, stop and patch the lens matrix."
    };
  }
  if (/\bteach|teachable|guidance|explain|one next thing|act without reading|short decision\b/.test(lower)) {
    return {
      optionId: "answer_first_teaching_contract",
      title: "Build An Answer-First Teaching Contract",
      description: "Make strategic answers start with a clear decision and one teachable next move before the deliberation details.",
      opportunityCost: "May compress some nuance, but it reduces Dean's reading burden and makes action easier.",
      evidenceFor: "The task asks for strategy that can be understood and acted on, not only validated.",
      proofNeeded: "Run teaching-strategy benchmarks where the user can identify the decision and next action in under one minute.",
      killCriteria: "If teaching outputs require a long report to find the decision, stop and rewrite the formatter."
    };
  }
  if (/\bledger|autonomous codex|general chatgpt superiority|provider\/model|prove|ordinary chatgpt|product strategy\b/.test(lower)) {
    return {
      optionId: "strategy_decision_ledger",
      title: "Build A Strategy Decision Ledger",
      description: "Record strategic decisions, rejected alternatives, evidence, and kill criteria so later strategy can learn without becoming memory spam.",
      opportunityCost: "Delays autonomous Codex loops and provider work, but creates continuity for broad reasoning.",
      evidenceFor: "The task is about product direction and proof of strategic improvement over time.",
      proofNeeded: "Compare two strategy tasks before and after ledger context and inspect whether the second answer avoids repeating settled debates.",
      killCriteria: "If the ledger stores conclusions without evidence or repeats stale decisions, stop and keep it candidate-only."
    };
  }
  return undefined;
}
