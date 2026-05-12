# Product Surface Demo Checklist

Generated for Phase 5 product-surface amputation.

## Fake-Complete Demo Path

```bash
npm install
npm run build
stax attach --repo ../demo-repo
echo "Fix the broken test" > ../demo-repo/.stax/task.md
# Codex works and writes .stax/codex-report.md
stax collect --repo ../demo-repo -- npm test
stax gate --repo ../demo-repo
stax status --repo ../demo-repo
stax next --repo ../demo-repo
```

## Pass Criteria

- A new user can name the six public commands.
- The demo shows missing proof rejected before command evidence exists.
- The demo shows command proof accepted only when it matches the audited
  worktree.
- `Accept` is explained as proof support for the current repo state, not general
  code correctness.

## Current Demo Status

```txt
Status: passed
Command: bash examples/fake-complete-demo/run-demo.sh
Exit code: 0
Verified behavior:
- first gate rejected a confident report with no command evidence
- second gate accepted after STAX-collected npm test evidence matched the worktree
- final proof strength was Audit-grade
```
