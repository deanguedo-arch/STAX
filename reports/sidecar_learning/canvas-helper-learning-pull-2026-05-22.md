# Canvas Helper Learning Pull

Generated: 2026-05-22
Source repo: `canvas-helper`
Source queue: `queues/sidecar_imports/pending`
Status: one approved STAX-wide candidate promoted with executable regression backing

## What Was Pulled

- Exported `reports/pattern_promotion/canvas-helper-impact-evidence-2026-05-22.json`.
- Rebuilt `docs/RAX_PATTERN_PROMOTION_IMPACT_REPORT.md` with both local STAX and Canvas Helper impact bundles.
- Added four new Canvas Helper candidates:
  - `cand_canvas-helper_sidecar_status_e8d6dd1f0652` (promoted after review)
  - `cand_canvas-helper_codex_report_75cd7cc20ddd`
  - `cand_canvas-helper_evt_unsafe_publish_blocked_bc145080ff5a_cd93f64016e2`
  - `cand_canvas-helper_evt_unsafe_publish_blocked_e77a355c51b7_172796066962`
- Added executable regression coverage in `tests/sidecarWatchCollect.test.ts`.
- Patched `src/projectControl/ProjectControlProofStack.ts` so course deploy proof can recognize export regeneration and live target proof when backed by strong local command evidence.
- Added a visual-proof refresh regression so no-source-diff status checks do not treat build-log `dist/` paths as changed visual files.

## High-Signal Lessons

- Course deploy claims need a dedicated proof contract: workspace source change, export regeneration, STAX-collected deploy command, live target verification, rendered visual proof, and rollback framing when a deploy is claimed.
- Visual and course-behavior claims need rendered screenshot or checklist proof. Source, CSS, or manifest diffs alone are not enough.
- Stale, wrong-worktree, wrong-commit, or failed command evidence must stay historical. It must not contaminate a newer current proof bundle after current evidence exists.
- Command output is strong proof only when collected through verified STAX command evidence for the target repo and worktree. Human-pasted output and non-execution command labels stay weak.
- Sidecar protocol checks need to distinguish a truly missing acknowledgement from capture lag when the Codex report contains the current ACK.
- Claim parsing should not treat URLs, proof-taxonomy labels, or prose slash phrases as repo file-path claims.
- Product truth and STAX proof hygiene are separate: Canvas Helper can have a successful live deploy while STAX correctly rejects the proof record because stale evidence or protocol state still fails.
- Structured sidecar packets with an explicit empty changed-file list must remain empty. Falling back to path scraping from command output can turn build artifacts into false visual-source diffs.

## Current Evidence Notes

- The Canvas Helper impact bundle contains 100 command-evidence records and 9 sidecar artifacts.
- The imported operating-window result reports 0 critical misses, full handoff contract present, and proof artifacts requested.
- The current Canvas Helper `.stax/status.json` was stale against the repository head observed by the impact export, so freshness handling is part of the lesson.
- The latest Canvas Helper status showed old failed deploy evidence and wrong-commit evidence influencing the current verdict.
- STAX now has a focused regression proving old failed deploy evidence remains historical once current course-deploy proof exists.
- STAX now has a focused regression proving current rendered screenshot proof can satisfy a visual refresh even when there is no source diff and command logs mention generated `dist/` assets.

## Recommended Review Targets

### `cand_canvas-helper_sidecar_status_e8d6dd1f0652`

- Target: `evals/candidates/`
- Status: promoted to `evals/candidates/cand_canvas-helper_sidecar_status_e8d6dd1f0652.json` and `queues/sidecar_imports/promoted/cand_canvas-helper_sidecar_status_e8d6dd1f0652.json`
- Why:
  - Best current summary of the reusable proof-contract lessons.
  - Captures stale command evidence contamination and protocol freshness issues in one status-derived candidate.
  - Now backed by the `keeps stale Canvas Helper deploy failures historical once current course-deploy proof exists` regression.

### One of the unsafe publish blocked candidates

- Candidates:
  - `cand_canvas-helper_evt_unsafe_publish_blocked_bc145080ff5a_cd93f64016e2`
  - `cand_canvas-helper_evt_unsafe_publish_blocked_e77a355c51b7_172796066962`
- Target: `evals/candidates/`
- Why:
  - Both capture the same unsafe release/deploy proof boundary.
  - Advance at most one after dedupe so the durable eval set does not learn duplicate noise.

### `cand_canvas-helper_codex_report_75cd7cc20ddd`

- Target: repo-scoped candidate queue
- Why:
  - Useful repo-scoped operational note for Canvas Helper.
  - Keep it repo-scoped as-is; it includes current Course Showcase cleanup context and should only become a generic ledger-freshness rule after review.

## Hold Or Dedupe

- `cand_canvas-helper_sidecar_status_0bf013466c2c` is an older version of the same status-derived lesson and is weaker than `cand_canvas-helper_sidecar_status_e8d6dd1f0652`.
- Existing General Psychology and responsive-sidebar candidates are useful, but most are product/workflow memories rather than STAX-wide rules.
- Existing policy-patch candidates around deploy boundaries should be reviewed together to avoid repeating the same release-proof contract in multiple places.

## Next Action

Deduplicate the two remaining unsafe publish blocked candidates before promoting any second release-boundary artifact.
