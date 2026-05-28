# Sidecar Learning Extraction Report

Generated: 2026-05-14

## Current Result

STAX sidecar harvest now treats attached-repo sidecars as mixed evidence stores, not as a single event schema.

`stax:harvest` now:

- imports valid `sidecar-learning-v1` learning events;
- skips trace-only events where `promotion.target` is `none`;
- skips non-learning sidecar event schemas such as preflight and proof-surface approval events;
- skips invalid JSON or invalid learning events without aborting the whole harvest;
- extracts a regression candidate from the latest `.stax/status.json` when the sidecar has learned a reusable proof lesson but no explicit learning event exists;
- deduplicates candidates across repeated harvests.

## Canvas Helper Harvest

Command:

```bash
npm run stax:harvest -- --from /Users/deanguedo/Documents/GitHub/canvas-helper
```

Observed result:

- Imported: 27 candidates
- Skipped trace-only events: 35
- Skipped non-learning sidecar events: 13
- Skipped invalid events: 0
- Re-run imported: 0 candidates

Candidate mix:

- 10 repo-memory candidates from Codex reports
- 16 global regression candidates from explicit sidecar learning events
- 1 archetype regression candidate from latest sidecar status

## Promotion Review Result

After human approval, STAX promoted the reusable regression/archetype candidates only:

- Promoted: 17 candidates
- Destination: `evals/candidates/`
- Queue record: `queues/sidecar_imports/promoted/`
- Left pending: 10 Canvas Helper repo-memory candidates

Promoted classes:

- Missing-proof catches
- Unsafe publish/deploy/release blocks
- Course-deploy proof contract archetype

Not promoted:

- Canvas Helper repo-memory notes from Codex reports
- Repo-specific task facts
- Trace-only sidecar observations

## Lessons Extracted From Canvas Helper Status

The status-derived candidate captured these reusable lessons:

- Course deploy claims need a dedicated proof contract: workspace source change, export regeneration, STAX-collected deploy command, live target verification, and rendered visual proof.
- Visual/course behavior claims should require rendered screenshot or checklist proof; source or CSS diffs alone are not enough.
- Stale, wrong-worktree, or wrong-commit command evidence must stay historical and cannot prove the current task.
- Command output is strong proof only when collected through verified STAX command evidence for the target repo/worktree.
- Sidecar protocol timing should distinguish a missing acknowledgement from a capture-lag warning when the report contains the current ACK.

## Regression Coverage

Added tests now cover:

- mixed sidecar events do not crash harvest;
- non-learning preflight/proof-surface events are skipped;
- trace-only command evidence events do not become learning candidates;
- sidecar status can generate a reviewable regression candidate;
- harvest dedupes repeated imports;
- URL/prose slash phrases are not treated as repo file-path claims;
- current-turn capture lag is downgraded when the Codex report contains the current ACK;
- Canvas course deploys map to `course_deploy_ready`;
- proof strength has a dedicated `course_deploy_ready` claim type.

## Boundary

Harvest still does not auto-promote anything. Candidates remain pending and require human approval before promotion into durable STAX behavior.

## 2026-05-28 Canvas Helper Follow-Up Harvest

After the Canvas Helper sidecar ran through the course-site workflow, STAX harvested the sidecar again instead of relying on a prose summary from the attached Codex agent.

Command:

```bash
npm run stax:harvest -- --from /Users/deanguedo/Documents/GitHub/canvas-helper --no-session-logs
```

Observed result:

- Imported: 24 new pending candidates
- Skipped trace-only events: 112
- Skipped non-learning sidecar events: 18
- Skipped invalid events: 0

Dashboard after harvest:

- Pending candidates: 80
- Promoted candidates: 24
- Rejected/deferred candidates: 1
- False accepts: 0
- False blocks: 0
- Useful blocks: 40
- Repo memory candidates: 61
- Repeated patterns: `unsafe_release_publish_sync_claim` (16), `visual_claim_without_rendered_proof` (9)

Aggregate review:

- Report: `reports/sidecar_learning/sidecar-import-aggregation-2026-05-28T14-03-55-877Z.md`
- Aggregate groups: 7
- Promotable aggregate groups: 5
- Human approval required: yes

Promotion priorities from the aggregate review:

1. `agg_mode_behavior_rule`: visual/course behavior claims require rendered screenshot or checklist proof; source/CSS diffs alone are not enough.
2. `agg_proof_boundary_rule`: wrong-repo, weak, stale, or non-current command evidence must not verify target repo work.
3. `agg_policy_safety_rule`: publish/sync/deploy/release claims require preflight, target validation, and scope checks.
4. `agg_schema_contract_rule`: malformed structured output should fail schema validation instead of passing silently.
5. `agg_codex_handoff_rule`: future bounded Codex prompts should include repo path, files, commands, acceptance criteria, and stop conditions.

Held or discarded groups:

- `agg_repo_specific_fact`: held local; repo-specific commands, paths, and task facts are evidence, not durable global learning.
- `agg_trace_fact`: discarded as one-off trace evidence.

The dashboard now recommends promotable aggregate groups before individual raw candidates. This makes the sidecar learning loop answer the actual operational question: "what did this attached repo teach STAX that is reusable?" rather than "which JSON file sorted first?"

## 2026-05-28 Mode Behavior Promotion Review

After human approval, STAX reviewed the top aggregate from the Canvas follow-up harvest:

- Aggregate: `agg_mode_behavior_rule`
- Decision: promote narrowly as a mode-contract patch candidate
- Artifact: `learning/proposals/mode_contract_patch_candidates/agg_mode_behavior_rule.json`
- Decision report: `reports/sidecar_learning/sidecar-aggregate-promotion-decisions-2026-05-28T14-24-35Z.md`

Promoted reusable behavior:

- visual, layout, and course-behavior completion claims require rendered screenshot, browser, or checklist proof
- source diffs, CSS diffs, ordinary command output, and prose do not prove visual behavior by themselves
- proof-rule wording about visual evidence is governance text, not a visual completion claim

Not promoted:

- Canvas Helper course names
- local screenshot filenames
- live URLs
- one-off deploy task facts
- raw Codex report wording

Regression/evidence backing:

- `fixtures/pattern_promotion/locked_replay_10_cases.json#locked_visual_diff_not_visual_proof`
- `reports/pattern_promotion/pattern-promotion-impact-2026-05-28T12-15-17-138Z.json`
- `tests/proofStrengthGate.test.ts`
- `tests/sidecarClaimExtractionPrecision.test.ts`
- `tests/sidecarImportAggregation.test.ts`

Dashboard behavior was also tightened: once an aggregate has a reviewed promotion artifact, the dashboard skips it for the next top recommendation and moves to the next unreviewed aggregate. The next aggregate to inspect is `agg_proof_boundary_rule`.
