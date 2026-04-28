# RAX Known Gaps Consensus Report

Date: 2026-04-28

## Mission

Close the highest-risk non-superiority gaps without turning STAX into a larger bureaucracy. The review standard was red/blue/green:

- Red: find how the patch can be gamed, overfit, hide failure, or create unsafe autonomy.
- Blue: find the smallest deterministic patch with tests.
- Green: keep only work that helps Dean solve project/repo problems faster.

The subagent pool was unavailable during this pass, so the review was executed as explicit local review roles and captured here rather than represented as live background agents.

## Consensus JSON

```json
[
  {
    "weakness": "Blind first-pass superiority",
    "position": "consensus",
    "main_risk": "Corrected benchmark wins can be relabelled as blind first-pass wins.",
    "recommended_patch": "Add FirstPassIntegrityGate with claim labels for blind_first_pass, post_correction_pass, trained_slice_pass, and superiority_candidate.",
    "files_to_touch": ["src/compare/FirstPassIntegrityGate.ts", "src/compare/FirstPassIntegritySchemas.ts", "tests/firstPassIntegrityGate.test.ts", "docs/RAX_FIRST_PASS_INTEGRITY_REPORT.md"],
    "tests_to_add": ["corrected fixture cannot be blind_first_pass", "locked fixture overwrite blocked", "post-correction remains post_correction_pass", "corrected-only evidence cannot reach superiority_candidate"],
    "acceptance_criteria": ["first-pass and corrected evidence cannot blur", "locked fixture overwrite attempts fail", "superiority candidate cannot be requested from corrected-only evidence"],
    "do_not_build": ["auto benchmark mutation", "auto promotion", "new superiority wording"],
    "go_no_go": "go",
    "reason": "This directly prevents fake superiority claims."
  },
  {
    "weakness": "Subtle proof-boundary distinctions",
    "position": "consensus",
    "main_risk": "Adjacent evidence can leak into broader claims, such as DOCX proof becoming PDF proof.",
    "recommended_patch": "Add ProofBoundaryClassifier with deterministic evidence-family scopes and required next proof.",
    "files_to_touch": ["src/evidence/ProofBoundaryClassifier.ts", "src/evidence/ProofBoundarySchemas.ts", "tests/proofBoundaryClassifier.test.ts", "evals/regression/proof_boundary_distinctions.json", "docs/RAX_PROOF_BOUNDARY_REPORT.md"],
    "tests_to_add": ["DOCX cannot verify PDF", "OCR cannot verify structured recovery", "course-shell cannot verify full e2e", "fixture cannot verify rendered export", "cf:convert cannot verify cf:validate", "no test script cannot become npm test"],
    "acceptance_criteria": ["verified and unverified scope are separated", "next proof is concrete", "adjacent proof does not broaden claims"],
    "do_not_build": ["LLM proof classifier", "repo mutation", "visual proof protocol yet"],
    "go_no_go": "go",
    "reason": "This fixes the exact boundary confusion exposed by the holdout work."
  },
  {
    "weakness": "Runtime truth without command output",
    "position": "consensus",
    "main_risk": "STAX can mistake scripts, test files, or source inspection for passing runtime evidence.",
    "recommended_patch": "Add RuntimeEvidenceGate with evidence-strength and truth-status labels.",
    "files_to_touch": ["src/evidence/RuntimeEvidenceGate.ts", "src/evidence/RuntimeEvidenceSchemas.ts", "tests/runtimeEvidenceGate.test.ts", "docs/RAX_RUNTIME_EVIDENCE_REPORT.md"],
    "tests_to_add": ["script exists is unknown", "test file exists is unknown", "pasted output is partial", "stored command evidence is scoped verified", "STAX eval cannot verify linked repo tests", "failed command overrides pass claim"],
    "acceptance_criteria": ["runtime claims require command output", "failed output blocks pass claims", "linked repo and STAX command scopes stay separate"],
    "do_not_build": ["command runner", "linked repo mutation", "approval bypass"],
    "go_no_go": "go",
    "reason": "This prevents the most common fake-complete route."
  },
  {
    "weakness": "Global superiority claims",
    "position": "consensus",
    "main_risk": "Slice wins get described as global wins.",
    "recommended_patch": "Keep existing superiority gates strict; strengthen only after first-pass/runtime boundaries land.",
    "files_to_touch": [],
    "tests_to_add": ["future: corrected holdout cannot become global superiority", "future: missing source/date blocks superiority"],
    "acceptance_criteria": ["slice_only and campaign_slice wording preserved"],
    "do_not_build": ["marketing superiority claims"],
    "go_no_go": "modify",
    "reason": "Important, but top-three gates reduce the root ambiguity first."
  },
  {
    "weakness": "Future unseen tasks",
    "position": "consensus",
    "main_risk": "Future holdouts recycle training data.",
    "recommended_patch": "Defer HoldoutFreshnessGate until first-pass integrity is enforced.",
    "files_to_touch": [],
    "tests_to_add": [],
    "acceptance_criteria": ["future holdouts are not corrected-case rewrites"],
    "do_not_build": ["auto task generator"],
    "go_no_go": "modify",
    "reason": "Freshness matters, but first-pass labels are prerequisite."
  },
  {
    "weakness": "Benchmark gaming",
    "position": "consensus",
    "main_risk": "Answers can stuff filenames and commands to win a heuristic scorer.",
    "recommended_patch": "Defer BenchmarkAdversary until proof/runtime boundaries land.",
    "files_to_touch": [],
    "tests_to_add": [],
    "acceptance_criteria": ["future mutated fixtures do not flip wildly"],
    "do_not_build": ["larger scoring rewrite now"],
    "go_no_go": "modify",
    "reason": "High value, but after the three proof gates."
  },
  {
    "weakness": "External baseline import",
    "position": "consensus",
    "main_risk": "Generic or stale external answers get treated as baselines.",
    "recommended_patch": "Defer formal import protocol; current benchmark already rejects missing source/date/prompt.",
    "files_to_touch": [],
    "tests_to_add": [],
    "acceptance_criteria": ["future import requires source, prompt, capture date, and drift confirmation"],
    "do_not_build": ["browser scraping automation"],
    "go_no_go": "modify",
    "reason": "Needed for workflow polish, not the immediate proof hole."
  },
  {
    "weakness": "Actually modifying linked repos",
    "position": "consensus",
    "main_risk": "Diagnosis turns into unsafe mutation.",
    "recommended_patch": "Do not build execution lane in this slice.",
    "files_to_touch": [],
    "tests_to_add": [],
    "acceptance_criteria": ["linked repo mutation remains out of scope"],
    "do_not_build": ["sandbox patch lane", "direct linked repo writes"],
    "go_no_go": "no_go",
    "reason": "Execution is useful later, but proof integrity comes first."
  },
  {
    "weakness": "Visual/UI proof without screenshots",
    "position": "consensus",
    "main_risk": "CSS/source claims get treated as rendered visual proof.",
    "recommended_patch": "Defer VisualEvidenceProtocol; ProofBoundaryClassifier now keeps rendered preview separate.",
    "files_to_touch": [],
    "tests_to_add": [],
    "acceptance_criteria": ["visual claims still require visual artifacts in future slice"],
    "do_not_build": ["browser automation in this slice"],
    "go_no_go": "modify",
    "reason": "Important for canvas-helper, but top-three runtime/proof gates are broader."
  },
  {
    "weakness": "Very low-evidence tasks",
    "position": "consensus",
    "main_risk": "Honest no_local_basis still leaves Dean stuck.",
    "recommended_patch": "Defer EvidenceRequestBuilder; RuntimeEvidenceGate defines the missing command-output layer first.",
    "files_to_touch": [],
    "tests_to_add": [],
    "acceptance_criteria": ["future no-evidence answers request the smallest evidence pack"],
    "do_not_build": ["large evidence wizard"],
    "go_no_go": "modify",
    "reason": "Useful next, but not top-three."
  },
  {
    "weakness": "Human judgment calls",
    "position": "consensus",
    "main_risk": "STAX may recommend or execute approvals without enough decision context.",
    "recommended_patch": "Defer JudgmentPacket; review router already separates human review/hard block.",
    "files_to_touch": [],
    "tests_to_add": [],
    "acceptance_criteria": ["future packets make yes/no decisions faster without bypassing approval"],
    "do_not_build": ["chat approvals"],
    "go_no_go": "modify",
    "reason": "Not the current proof bottleneck."
  },
  {
    "weakness": "Broad creative strategy",
    "position": "consensus",
    "main_risk": "Strategy becomes unsupported proof language.",
    "recommended_patch": "Keep current strategic benchmark work; do not add another strategy mode in this proof slice.",
    "files_to_touch": [],
    "tests_to_add": [],
    "acceptance_criteria": ["strategy stays labelled as reasoned strategy unless evidence-backed"],
    "do_not_build": ["strategy memory", "autonomous strategic loop"],
    "go_no_go": "modify",
    "reason": "Already improved in the prior broad reasoning pass."
  },
  {
    "weakness": "Multi-day robustness",
    "position": "consensus",
    "main_risk": "Timestamps become cosmetic.",
    "recommended_patch": "Defer BaselineDateGate until FirstPassIntegrityGate is in place.",
    "files_to_touch": [],
    "tests_to_add": [],
    "acceptance_criteria": ["future robustness requires real capture-date diversity"],
    "do_not_build": ["timestamp-only proof upgrade"],
    "go_no_go": "modify",
    "reason": "First-pass labels are the foundation."
  },
  {
    "weakness": "External-source diversity",
    "position": "consensus",
    "main_risk": "Same thread/context counted twice.",
    "recommended_patch": "Defer source diversity gate.",
    "files_to_touch": [],
    "tests_to_add": [],
    "acceptance_criteria": ["future diversity counts real sources or contexts"],
    "do_not_build": ["fake source inflation"],
    "go_no_go": "modify",
    "reason": "Important for superiority, lower ROI than first-pass/runtime proof gates today."
  },
  {
    "weakness": "Real autonomous project execution",
    "position": "consensus",
    "main_risk": "STAX claims agentic fixing without sandbox evidence.",
    "recommended_patch": "Do not build; future ExecutionMaturity ladder before any execution lane.",
    "files_to_touch": [],
    "tests_to_add": [],
    "acceptance_criteria": ["current STAX honestly stays answer/plan/proof lane"],
    "do_not_build": ["autonomous repo fixing"],
    "go_no_go": "no_go",
    "reason": "Autonomy before proof integrity would create exactly the fake-superiority risk this slice is closing."
  }
]
```

## Build Decision

Implement only:

1. FirstPassIntegrityGate.
2. ProofBoundaryClassifier.
3. RuntimeEvidenceGate.

Everything else is either downstream of those gates or a future execution/autonomy risk.
