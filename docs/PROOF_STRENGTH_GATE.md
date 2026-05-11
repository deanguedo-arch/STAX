# Proof Strength Gate

STAX scores proof quality, not truth.

The Proof Strength Gate is a deterministic project-control layer for AI coding
claims. It answers:

```txt
Is the available proof strong enough to trust this claim?
```

It does not call a model, infer whether the code is correct, or modify STAX Core
signal confidence.

## Claim Types

Phase 1 supports only:

- `implementation_complete`
- `tests_passed`
- `visual_behavior_verified`
- `release_ready`
- `security_fixed`

## Inputs

The gate consumes:

- claim type and claim text
- `EvidenceGroundingResult`
- command evidence from `CommandEvidenceStore`
- optional `RepoEvidencePack`
- explicit evidence flags for visual, release, rollback, and security proof

## Output

The result is a stable JSON object:

```txt
proof_strength.json
```

It includes:

- raw score
- final score
- label: `Missing`, `Weak`, `Provisional`, `Strong`, `Audit-grade`, or `Reject`
- caps applied
- reject reasons
- missing, weak, and strong proof
- primary limiter
- one next action

## Caps And Rejects

Hard caps and reject conditions are the product.

- No command evidence caps implementation, test, release, and security claims at
  `Provisional`.
- Codex-reported command output only caps the result at `Provisional`.
- Failed command evidence returns `Reject`.
- Wrong repo, cwd, linked repo, or workspace evidence returns `Reject` when the
  expected context is available.
- Docs-only evidence for implementation-complete claims returns `Reject`.
- Visual behavior without rendered proof caps the result at `Provisional`.
- Release-ready without preflight, release gate, or rollback proof caps the result
  at `Provisional`.
- Security-fixed without security-specific proof caps the result at
  `Provisional`.

## Persistence

Repo-facing runtime runs can persist:

```txt
runs/YYYY-MM-DD/<run-id>/proof_strength.json
```

Sidecar gate runs persist the same artifact shape at:

```txt
.stax/proof_strength.json
```

They also write a stable repo-tracked proof report:

```txt
.stax/reports/latest-proof-report.md
```

That report is sanitized for repo history: it contains verdict, proof-strength
score, caps, durable findings, command evidence IDs, artifact paths, and the
next action. It does not use raw command logs, runtime heartbeat details, or
turn-capture transcripts as the human-facing report.

Sidecar gates also append or refresh a generated report section:

```txt
.stax/codex-report.md
```

The generated `## STAX Proof Strength` section is wrapped in STAX markers and
is stripped before the next proof-strength evaluation. It is display/audit
output, not a Codex-authored completion claim.

The run trace also includes a compact summary:

```json
{
  "proofStrength": {
    "label": "Provisional",
    "rawScore": 0.68,
    "finalScore": 0.68,
    "capApplied": ["visual_claim_without_visual_proof"],
    "primaryLimiter": "Visual behavior claims require rendered visual proof."
  }
}
```

The artifact is first-class. Status cards and prettier output should be treated
as display surfaces over this evidence, not as the source of truth.
