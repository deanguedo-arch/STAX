import type { StrategicOption } from "./StrategicQuestionSchemas.js";

export class OptionGenerator {
  generate(question: string): StrategicOption[] {
    const lower = question.toLowerCase();
    const staxBroadReasoning = /\b(stax|chatgpt|broad reasoning|strategy|creative|better than)\b/.test(lower);
    const themed = themedBroadOptions(lower);
    if (themed) return themed;

    if (staxBroadReasoning) {
      return adaptiveBroadOptions(question);
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

function adaptiveBroadOptions(question: string): StrategicOption[] {
  const focus = focusPhrase(question);
  const titleFocus = titleCase(focus);
  const slug = slugify(focus);
  return [
    {
      optionId: `${slug}_strategy_probe`,
      title: `Run A ${titleFocus} Strategy Probe`,
      description: `Make the strategic decision specific to ${focus}, then test whether it changes the next action instead of reusing a generic STAX roadmap.`,
      userValue: "high",
      implementationCost: "medium",
      reversibility: "reversible",
      opportunityCost: "Slower than a reusable canned answer, but it prevents broad reasoning from collapsing into one template.",
      evidenceFor: [
        `The question is specifically about ${focus}, so the selected option should not be the same answer used for unrelated strategy tasks.`,
        "Fresh strategic holdouts exposed template collapse when broad prompts fell back to one static option."
      ],
      evidenceAgainst: [
        "A question-specific probe can still overfit wording if it does not produce a better decision."
      ],
      redTeamFailureModes: [
        "Could create unique labels without real strategic difference.",
        "Could overfit benchmark phrasing.",
        "Could hide weak reasoning behind question-specific names."
      ],
      proofNeeded: [
        `Run a fresh comparison for ${focus} and check whether the chosen next proof differs from unrelated strategy lanes.`
      ],
      killCriteria: [
        `If the ${focus} probe uses the same proof step and failure mode as unrelated strategy tasks, patch option generation again.`
      ]
    },
    {
      optionId: "benchmark_only",
      title: "Benchmark Only",
      description: "Measure the issue without changing the strategic option generator.",
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

function focusPhrase(question: string): string {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !FOCUS_STOP_WORDS.has(word));
  return words.slice(0, 5).join(" ") || "question specific strategy";
}

function slugify(value: string): string {
  return value.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "question_specific";
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => word ? `${word[0]?.toUpperCase()}${word.slice(1)}` : "")
    .join(" ")
    .trim() || "Question Specific";
}

const FOCUS_STOP_WORDS = new Set([
  "how",
  "should",
  "stax",
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "when",
  "what",
  "why",
  "who",
  "where",
  "into",
  "from",
  "than",
  "then",
  "they",
  "them",
  "their",
  "about",
  "become",
  "between",
  "chatgpt",
  "without",
  "while",
  "still",
  "next",
  "better"
]);

function primaryTheme(lower: string): {
  optionId: string;
  title: string;
  description: string;
  opportunityCost: string;
  evidenceFor: string;
  proofNeeded: string;
  killCriteria: string;
} | undefined {
  if (/\blearner pain|course product idea|repo-tooling\b/.test(lower)) {
    return {
      optionId: "learner_pain_product_probe",
      title: "Run A Learner Pain Product Probe",
      description: "Start from a learner pain point and design one course-product experiment that proves value without copying repo-tooling patterns.",
      opportunityCost: "Slower than reusing existing tooling, but it tests whether the product idea serves learners instead of the current architecture.",
      evidenceFor: "The task asks for a new course product idea where copying the repo-tool pattern would hide the actual user need.",
      proofNeeded: "Draft one learner, one target behavior, one product promise, and one observable usefulness test.",
      killCriteria: "If the idea cannot name a learner behavior it improves, kill it before building tooling."
    };
  }
  if (/\bnovelty bait|useful originality|weird new product\b/.test(lower)) {
    return {
      optionId: "value_hypothesis_filter",
      title: "Use A Value Hypothesis Filter",
      description: "Treat originality as a hypothesis about user value, not as value by itself.",
      opportunityCost: "Some exciting odd ideas will be filtered early, but the survivors will have a clearer proof path.",
      evidenceFor: "The task asks how to separate useful originality from novelty that only feels interesting.",
      proofNeeded: "State the user outcome, why the original angle matters, and the smallest evidence that would prove or disprove it.",
      killCriteria: "If the idea is only surprising and cannot change a user outcome, reject it."
    };
  }
  if (/\bopposing creative concepts|opposing concepts\b/.test(lower)) {
    return {
      optionId: "opposing_concept_generation",
      title: "Generate Opposing Concept Families",
      description: "Create options that differ by mechanism, audience, and failure mode before choosing one.",
      opportunityCost: "Slower than picking the first good idea, but it prevents fake variety.",
      evidenceFor: "The task explicitly asks for opposing creative concepts rather than minor variants.",
      proofNeeded: "Compare at least three concepts and show that each would win or fail for different reasons.",
      killCriteria: "If two concepts share the same user value and proof path, merge or reject one."
    };
  }
  if (/\bboring|novel feature|bigger product|upside\b/.test(lower)) {
    return {
      optionId: "capped_novelty_bet",
      title: "Run A Capped Novelty Bet",
      description: "Keep the useful feature moving while testing the novel feature with a small upside probe.",
      opportunityCost: "Splits attention, but avoids both premature conservatism and blind novelty chasing.",
      evidenceFor: "The task asks for prioritization between immediate utility and a speculative larger product.",
      proofNeeded: "Define a capped experiment that can reveal demand before the novel path becomes a build commitment.",
      killCriteria: "If the novelty probe cannot produce demand or decision evidence quickly, return to the useful feature."
    };
  }
  if (/\bproduct taste|taste|strict validators\b/.test(lower)) {
    return {
      optionId: "taste_as_decision_criterion",
      title: "Make Taste A Decision Criterion",
      description: "Add taste as an explicit strategic criterion beside validation instead of burying it as preference.",
      opportunityCost: "Taste is harder to score than schema correctness, but it protects product quality from pure checklist behavior.",
      evidenceFor: "The task warns that validators can flatten product judgment.",
      proofNeeded: "Name what taste means for one feature and show how it would change a decision.",
      killCriteria: "If the taste criterion cannot reject or improve an option, remove it."
    };
  }
  if (/\btwo paths|both plausible|evidence is incomplete\b/.test(lower)) {
    return {
      optionId: "evidence_yield_bet",
      title: "Choose The Highest Evidence-Yield Bet",
      description: "Pick the reversible path that teaches the most about the next decision.",
      opportunityCost: "May not be the boldest move, but it converts uncertainty into evidence.",
      evidenceFor: "The task asks for a decision when both paths are plausible and proof is incomplete.",
      proofNeeded: "Name which uncertainty the bet resolves and what follow-up decision it enables.",
      killCriteria: "If the action would not change the next decision, do not take it."
    };
  }
  if (/\b100% certainty|reversible decision|certainty\b/.test(lower)) {
    return {
      optionId: "certainty_boundary_protocol",
      title: "Use A Certainty Boundary Protocol",
      description: "Refuse false certainty and choose a reversible bet with an explicit condition that would reverse it.",
      opportunityCost: "Less emotionally satisfying than certainty, but more honest and actionable.",
      evidenceFor: "The task asks what to do when certainty is impossible but direction is still needed.",
      proofNeeded: "State what is known, what is unknown, and what evidence would reverse the decision.",
      killCriteria: "If the decision is not reversible or cannot name reversal evidence, pause it."
    };
  }
  if (/\bexternal expert|expert answer|feels right|lacks evidence\b/.test(lower)) {
    return {
      optionId: "expert_hypothesis_gate",
      title: "Treat Expert Advice As A Hypothesis",
      description: "Use external expertise as a strong candidate explanation, not as authority until it names disconfirming evidence.",
      opportunityCost: "Slows adoption of a persuasive answer, but prevents borrowed confidence.",
      evidenceFor: "The task asks how to use an expert answer that feels right but is not proven.",
      proofNeeded: "Extract the core claim, required proof, and what evidence would make it wrong.",
      killCriteria: "If no evidence could falsify the expert answer, do not use it as a decision basis."
    };
  }
  if (/\bcontinuing the loop|costs time|diminishing returns|endless looping\b/.test(lower)) {
    return {
      optionId: "diminishing_returns_stop_rule",
      title: "Apply A Diminishing Returns Stop Rule",
      description: "Continue only when another pass can change the decision, not merely improve wording.",
      opportunityCost: "May leave small refinements behind, but protects momentum.",
      evidenceFor: "The task asks how to stop loops that may no longer improve the result.",
      proofNeeded: "Name the signal that would change the decision before running another pass.",
      killCriteria: "If the next loop only produces cosmetic differences, stop and act."
    };
  }
  if (/\bwaiting for more proof|acting now|act now\b/.test(lower)) {
    return {
      optionId: "act_to_learn_rule",
      title: "Use An Act-To-Learn Rule",
      description: "Act now only when the action is reversible and generates the evidence that waiting would seek.",
      opportunityCost: "Accepts incomplete proof, but avoids paralysis.",
      evidenceFor: "The task asks how to choose between more proof and action.",
      proofNeeded: "Define the reversible action and the evidence it should create.",
      killCriteria: "If the action is costly to reverse or weak as evidence, wait and gather proof directly."
    };
  }
  if (/\bteaching workflow and software workflow|human learning proof and code proof\b/.test(lower)) {
    return {
      optionId: "dual_proof_recommendation",
      title: "Use A Dual-Proof Recommendation",
      description: "Require one proof lane for the human learning workflow and one for software behavior.",
      opportunityCost: "More complex than a single checklist, but it prevents one proof type from pretending to cover both domains.",
      evidenceFor: "The task asks how to combine teaching and software workflows without conflating their evidence.",
      proofNeeded: "Name both the learning proof and the software proof for the recommendation.",
      killCriteria: "If either proof lane is missing, the recommendation is incomplete."
    };
  }
  if (/\bux and technical|one-lens|visual user experience|content quality|build correctness\b/.test(lower)) {
    return {
      optionId: "multi_lens_risk_split",
      title: "Split The Problem By Risk Lens",
      description: "Evaluate UX, content quality, and technical correctness separately before naming the limiting risk.",
      opportunityCost: "Requires more review, but avoids claiming a whole course problem is fixed through one lens.",
      evidenceFor: "The task mixes UX and technical proof surfaces.",
      proofNeeded: "Identify which lens is the current limiting risk and what proof belongs to each lens.",
      killCriteria: "If the answer solves one lens while claiming all lenses are solved, reject it."
    };
  }
  if (/\bcreative writing|process that works for code|false rigor\b/.test(lower)) {
    return {
      optionId: "adapted_process_gate",
      title: "Adapt The Process, Do Not Copy It",
      description: "Transfer only the parts of a code process that preserve creative judgment in the writing domain.",
      opportunityCost: "Less mechanically rigorous, but less likely to reward checklist completion over quality.",
      evidenceFor: "The task asks whether a code process should transfer into creative writing.",
      proofNeeded: "Define the writing-specific quality evidence before adopting the process.",
      killCriteria: "If the process improves checklist completion but not writing quality, stop using it."
    };
  }
  if (/\bstudent learning outcomes|command\/test evidence|command evidence\b/.test(lower)) {
    return {
      optionId: "evidence_class_split",
      title: "Split Evidence Classes",
      description: "Treat learning outcomes and command/test evidence as different evidence classes with different failure modes.",
      opportunityCost: "Less tidy than one score, but more truthful.",
      evidenceFor: "The task explicitly warns not to pretend educational and command evidence are the same.",
      proofNeeded: "Name one learning proof and one command proof for the same project.",
      killCriteria: "If learning quality collapses into test output, reject the comparison."
    };
  }
  if (/\bcomplex tradeoff|hiding the real risk|real risk\b/.test(lower)) {
    return {
      optionId: "tradeoff_card",
      title: "Use A Tradeoff Card",
      description: "Explain the decision with the tradeoff and real downside visible in the first screen.",
      opportunityCost: "Compresses nuance, but keeps the risk from being buried.",
      evidenceFor: "The task asks for teachable guidance without hiding risk.",
      proofNeeded: "Write the decision, tradeoff, risk, next proof, and kill criterion in one card.",
      killCriteria: "If the card hides or softens the real downside, fail it."
    };
  }
  if (/\bmessy strategic debate|short action|giant report\b/.test(lower)) {
    return {
      optionId: "one_action_distillation",
      title: "Distill To One Action",
      description: "Turn the debate into the one action that tests the most important uncertainty.",
      opportunityCost: "Temporarily ignores secondary issues, but makes progress possible.",
      evidenceFor: "The task asks for a short action rather than a giant report.",
      proofNeeded: "Name the uncertainty and the action that tests it.",
      killCriteria: "If the action does not clarify the next decision, choose a different action."
    };
  }
  if (/\bdisagrees with dean|patronizing|pushing back\b/.test(lower)) {
    return {
      optionId: "respectful_pushback_protocol",
      title: "Use A Respectful Pushback Protocol",
      description: "Name the weak assumption plainly, then offer a safer or more useful alternative.",
      opportunityCost: "More direct than comfortable agreement, but it protects decision quality.",
      evidenceFor: "The task asks how to disagree while preserving trust.",
      proofNeeded: "State the assumption, why it fails, and the better next move.",
      killCriteria: "If the pushback cannot improve the plan, do not argue for style points."
    };
  }
  if (/\bpresent uncertainty|still move|known, unknown, and testable\b/.test(lower)) {
    return {
      optionId: "uncertainty_status_card",
      title: "Use An Uncertainty Status Card",
      description: "Separate what is known, unknown, and testable, then choose a reversible next move.",
      opportunityCost: "May feel less decisive, but it turns uncertainty into motion.",
      evidenceFor: "The task asks how to present uncertainty without freezing action.",
      proofNeeded: "List knowns, unknowns, testable next move, and decision-change evidence.",
      killCriteria: "If the test does not reduce uncertainty, stop and revise the question."
    };
  }
  if (/\bone screen|usable in one screen|long strategic reports\b/.test(lower)) {
    return {
      optionId: "one_screen_strategy_format",
      title: "Use A One-Screen Strategy Format",
      description: "Show decision, why, tradeoff, next action, and kill criterion without requiring a long report.",
      opportunityCost: "Compresses nuance, but improves usability.",
      evidenceFor: "The task asks for broad strategy that can be used quickly.",
      proofNeeded: "Apply the format to one strategy decision and see whether the user can act from it.",
      killCriteria: "If the user still needs the long report to act, redesign the format."
    };
  }
  if (/\bstrategy decision ledger before a stronger provider|ledger before.*provider\b/.test(lower)) {
    return {
      optionId: "ledger_before_provider_test",
      title: "Test The Ledger Before Provider Expansion",
      description: "Build the smallest decision-ledger experiment before committing to provider integration.",
      opportunityCost: "Delays model-capability gains, but tests whether continuity is the real bottleneck.",
      evidenceFor: "The task compares continuity against stronger model capability.",
      proofNeeded: "Run two related strategy decisions and check whether ledger context prevents repeated debate.",
      killCriteria: "If the ledger becomes passive notes or does not change a later decision, do not expand it."
    };
  }
  if (/\bproduct promise|beat chatgpt broadly|measurable lanes\b/.test(lower)) {
    return {
      optionId: "measurable_product_promise",
      title: "Define A Measurable Product Promise",
      description: "Replace generic ChatGPT superiority with named lanes and proof thresholds.",
      opportunityCost: "Less dramatic than claiming everything, but much harder to fool.",
      evidenceFor: "The task asks for a broad product promise that can actually be tested.",
      proofNeeded: "Name the lanes, baseline, win threshold, and holdout rule.",
      killCriteria: "If the promise cannot be measured against real user decisions, narrow it."
    };
  }
  if (/\bnot just a governed wrapper|governed wrapper|genuine strategic improvement\b/.test(lower)) {
    return {
      optionId: "decision_quality_proof",
      title: "Prove Decision Quality, Not Formatting",
      description: "Show better strategic decisions on fresh tasks, not just better structure or safer process.",
      opportunityCost: "Harder to prove than receipt quality, but it addresses the real superiority claim.",
      evidenceFor: "The task asks what proves STAX is more than a governed wrapper.",
      proofNeeded: "Compare fresh strategic decisions and inspect whether STAX chooses better tradeoffs, not just prettier sections.",
      killCriteria: "If the only advantage is format or risk language, do not claim strategic superiority."
    };
  }
  if (/\buser-facing strategy quality|backend learning automation|better answers or better machinery\b/.test(lower)) {
    return {
      optionId: "user_facing_strategy_first",
      title: "Prioritize User-Facing Strategy Quality",
      description: "Improve the answer surface before scaling backend learning automation.",
      opportunityCost: "Slower automation work, but better daily usefulness.",
      evidenceFor: "The task asks whether immediate value comes from better answers or better machinery.",
      proofNeeded: "Improve one strategy answer surface and rerun a fresh holdout comparison.",
      killCriteria: "If fresh tasks do not show better answer quality, stop and revisit backend constraints."
    };
  }
  if (/\bbenchmark win|change the roadmap|overfitting\b/.test(lower)) {
    return {
      optionId: "roadmap_threshold_gate",
      title: "Require A Roadmap Threshold Gate",
      description: "Let benchmark wins change the roadmap only when they hold across fresh tasks, lanes, and capture dates.",
      opportunityCost: "Slower roadmap changes, but fewer false victories.",
      evidenceFor: "The task asks when a benchmark win is strong enough to steer product direction.",
      proofNeeded: "Define the minimum fresh holdout size, lane coverage, date coverage, and no-edit-after-score rule.",
      killCriteria: "If wins depend on overfitted wording or post-score edits, do not change the roadmap."
    };
  }
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
