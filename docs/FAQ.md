# STAX FAQ

## What is STAX?

STAX is a local proof gate for AI-coded work. It checks whether a coding agent's
claims are backed by repo diff, command output, tests, screenshots, data proof,
release proof, PR artifacts, and human approvals.

## Does STAX replace Codex?

No. Codex or another coding agent still does the work. STAX audits the claimed
work before you trust it.

## What verdicts can STAX return?

- `Accept`: the current claims are backed by enough local proof.
- `Provisional`: useful proof exists, but a freshness, scope, or human-review
  boundary remains.
- `Reject`: the claim is unsupported, risky, malformed, or contradicted by
  evidence.
- `Human Review`: STAX found a judgment boundary it should not decide alone.

## Why did STAX reject if the Codex report says tests passed?

Because the report is only a claim. STAX needs captured command evidence with
the command, cwd, repo, branch, commit, output, and exit code. Use:

```bash
npm run stax:collect -- --repo ../my-project -- npm test
```

Then rerun:

```bash
npm run stax:gate -- --repo ../my-project
```

## Why did STAX return Provisional?

Usually because the proof is partly good but not complete. Common causes are a
missing fresh Codex turn capture, missing sidecar heartbeat, stale command
evidence, or a human-review boundary.

## Does STAX run commands automatically?

Only when you explicitly run `stax collect` with a command. It does not enable
uncontrolled shell execution, auto-push, auto-merge, auto-deploy, or auto-promote
memory.

## Does STAX require OpenAI?

No. The sidecar proof-gate workflow is local. OpenAI is only required if you
choose an OpenAI-backed provider for separate runtime behavior.

## What changes for an attached repo like brightspacequizexporter?

The attached repo does not need to become a STAX project. STAX adds a local
`.stax/` sidecar and expects work to flow through:

```txt
task -> Codex work -> codex-report.md -> command evidence -> gate -> next prompt
```

For normal coding, the main difference is that "done" now means the report and
local evidence agree.

## Is the fitness signal pipeline the product?

No. `stax_fitness` is an explicit legacy domain mode. General `STAX` should mean
the proof gate and governed runtime, not fitness tracking.
