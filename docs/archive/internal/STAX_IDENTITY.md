# STAX Identity

STAX is the adaptive rule-aware learning/runtime system.

RAX is the internal runtime engine/name where still used.

`stax_fitness` is one explicit optional domain/demo mode. It is not the STAX product identity.

Hard routing rule:

```txt
The word STAX alone must never route to stax_fitness.
```

General STAX work should route to system modes such as `learning_unit`, `planning`, `project_brain`, `codex_audit`, `policy_drift`, evals, corrections, and approved learning queues.

The system improves through an approved learning loop:

```txt
input/command -> trace -> LearningEvent -> queue -> proposal -> approval -> promoted system update
```

This is not autonomous self-modification. Learning proposals are evidence, not authority.
