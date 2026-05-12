# Product Surface Archive Map

Generated for Phase 5 product-surface amputation.

## Classification

```txt
CORE_PUBLIC:
- stax attach
- stax collect
- stax gate
- stax status
- stax next
- stax preflight

CORE_VALIDATION:
- build
- test
- typecheck
- validate
- validate:hardened
- validate:staxcore:strict

INTERNAL_STAX:
- stax:sidecar-upgrade
- stax:turn-contract
- stax:next-prompt
- stax:sidecar:refresh
- stax:watch
- stax:codex-collect
- stax:harvest
- stax:review-imports
- stax:aggregate-imports
- stax:promote-import
- stax:learning-dashboard
- stax:trials:phase1
- stax:claims:phase3
- stax:dogfood:observer
- stax:rollout:gate
- stax:ops-dashboard

INTERNAL_RESEARCH_OR_HISTORY:
- campaign:*
- repo-transfer:*
- pr-artifact:*
- release:*
- staxcore:*
- audit:*
```

## Rule

Do not delete internal tooling during this phase. Keep the public docs and
operator story to the six public commands, and move historical/research docs
behind archive references before removing code.

