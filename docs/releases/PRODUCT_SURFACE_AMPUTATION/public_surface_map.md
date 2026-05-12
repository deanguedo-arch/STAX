# Product Surface Public Command Map

Generated for Phase 5 product-surface amputation.

## Public Commands

- `stax attach`
- `stax collect`
- `stax gate`
- `stax status`
- `stax next`
- `stax preflight`

## Public Boundary

The public product path is:

```txt
Attach STAX.
Write the task.
Let Codex work.
Collect proof.
Run the gate.
Read status and next prompt.
Use preflight only at a workflow boundary.
```

## Non-Public Commands

Package scripts, trial runners, harvest tools, campaign scripts, dashboards,
release checks, and historical RAX commands are internal tooling. They may stay
in the repo while the product surface is narrowed, but they are not the public
operator path.

