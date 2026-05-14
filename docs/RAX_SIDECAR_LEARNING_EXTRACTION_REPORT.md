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
