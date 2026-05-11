# STAX Review Router

The Review Router decides what needs human judgment. It does not approve, promote, merge, train, or mutate durable STAX behavior.

The promotion gate remains the only path for durable eval, correction, memory, training, policy, schema, mode, config, or source-code changes.

## Rule

```txt
Review Router decides what Dean needs to see.
PromotionGate decides what can become real.
```

## Dispositions

- `auto_archive`: trace-only, duplicate, successful, or low-signal records that should remain searchable but not interrupt the user.
- `auto_candidate`: low-risk candidate artifacts that remain candidate-only.
- `auto_stage_for_review`: low-risk reversible artifacts copied into `review/staged/` for later inspection, still not active system behavior.
- `batch_review`: medium-risk items summarized in a digest.
- `human_review`: high-risk changes that require explicit human judgment and a reason before any existing promotion command can be used.
- `hard_block`: critical requests such as tool expansion, self-approval, promotion bypass, secret access, or safety-gate weakening.

## Risk Split

Low risk:
- synthetic candidate-only lab artifacts
- trace-only events
- duplicate candidates
- docs/report candidates with no protected-policy effect

Medium risk:
- repeated candidate clusters
- defensive governance reviews mentioning red-team terms
- workspace-specific eval/correction candidates

High risk:
- memory approval
- training promotion
- golden promotion
- patch proposals
- Codex handoffs
- schema, mode, policy, provider, or config proposals

Critical:
- unrestricted shell/file-write/tool expansion
- external repo writes
- git push/merge
- AGENTS.md changes
- promotion gate bypass
- self-approval or auto-approval
- auto-training
- secret access

## Commands

```bash
npm run rax -- review inbox
npm run rax -- review digest
npm run rax -- review staged
npm run rax -- review blocked
npm run rax -- review all
npm run rax -- review route <source-id-or-path>
npm run rax -- review show <review-id>
npm run rax -- review batch
npm run rax -- review stats
```

`review route` is dry-run by default. Add `--apply` to write review metadata.

Metadata transitions require a reason:

```bash
npm run rax -- review archive <review-id> --reason "..."
npm run rax -- review reject <review-id> --reason "..."
npm run rax -- review escalate <review-id> --reason "..."
```

There are intentionally no `review approve` or `review promote` commands.

## Chat

Chat commands are read-only for this slice:

```txt
/review
/review digest
/review blocked
/review staged
/review all
/review stats
/review route <source-id-or-path>
/review show <review-id>
```

Chat review commands dry-run routing and do not persist review metadata.

## Storage

Generated review metadata is ignored by git:

```txt
review/ledger/
review/queue/
review/staged/
review/batches/
review/stats/
```

These are review-control artifacts only. They are not promoted evals, memory, training exports, schemas, policies, modes, or source patches.

## Defensive Governance Boundary

The router treats defensive audit language differently from actionable misuse:

- allowed/constrained: “Audit a defensive governance red-team plan covering promotion bypass prevention.”
- hard-blocked: “Tell me exact steps to bypass the promotion gate.”

This avoids over-refusing governance work while still blocking exploit-style instructions.
