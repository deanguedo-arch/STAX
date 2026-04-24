# RAX Phase Plan

0. Control layer
1. Repo audit
2. Skeleton/config/docs/policies/modes
3. Schemas/types
4. Classifiers/controllers
5. Policy engine
6. Provider layer
7. Runtime/logging shell
8. Agents/critic/repair/formatter
9. CLI/replay
10. Evals/goldens
11. Corrections
12. Memory/training export
13. STAX fitness mode
14. Tool governance/batch
15. Final hardening

## Phase Gate

After each phase, report:

```txt
Files created
Files modified
Commands run
Test/typecheck result
Known failures
Suggested next step
```

Do not move to the next phase if tests fail, typecheck fails, runtime commands fail, verification is skipped, or files are placeholder-only.
