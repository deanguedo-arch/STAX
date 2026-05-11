# STAX Workspaces

STAX is the central command center. External repositories are linked as workspaces so STAX can read safe project context, record evidence, and keep the feedback loop local.

Do not copy STAX into external repos. Linked repos are read-only in this slice.

## Workspace Model

Each workspace has durable state under:

```txt
workspaces/<workspace>/
  workspace.json
  PROJECT_STATE.md
  DECISION_LOG.md
  KNOWN_FAILURES.md
  NEXT_ACTIONS.md
  EVIDENCE_REGISTRY.md
  CLAIM_LEDGER.md
  evals/
  goldens/
  corrections/
  lab/
```

The active workspace remains recorded in `workspaces/registry.json`. `WorkspaceStore` owns schema-aware workspace files, `WorkspaceRegistry` remains the compatibility/index API, and `WorkspaceContext` is the shared resolver for CLI, chat, runtime, evidence collection, and `/state`.

## Read-Only Repo Access

Repo summary and search only read safe text files. They ignore `.git`, `node_modules`, `dist`, `build`, `coverage`, `.next`, `out`, `vendor`, `.cache`, `tmp`, `.env*`, key/certificate files, secret-like filenames, symlinks, binaries, and files over the size cap.

No linked repo writes, shell execution, commits, pushes, test runs, or STAX file copies are allowed in this slice.

## Commands

```bash
rax workspace create canvas-helper --repo ../canvas-helper
rax workspace use canvas-helper
rax workspace status
rax workspace repo-summary
rax workspace search "canvas"
npm run chat
/workspace repo-summary
/workspace search canvas
/state
```

## Command Evidence

Verification-style commands can produce first-class command evidence under `evidence/commands/`. The artifact stores redacted stdout/stderr paths, exit code, summary, truncation flags, workspace metadata, and a hash.

Command evidence strengthens Verified Audit only when it supports a specific claim. For example, a passing regression command can support “regression evals passed,” but it does not prove an unrelated repo behavior or feature-completion claim.
