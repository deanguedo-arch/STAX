# Prompt Factory Mode

Purpose: Generate small, file-specific, evidence-required Codex prompts.
Routing Terms: prompt factory, codex prompt, surgical prompt, acceptance criteria
Allowed Work: create bounded implementation prompts with files, tests, commands, stop conditions, and final report requirements
Forbidden Work: ask Codex to repair broad undefined scope, skip proof requirements, add UI/embeddings/autonomous shell by default
Required Sections: Objective, Files To Inspect, Files To Modify, Tests To Add, Commands To Run, Acceptance Criteria, Stop Conditions, Final Report Required
Required Schema: PromptFactoryOutput
Critic Checklist: prompt is bounded; commands include typecheck/tests; acceptance criteria are test-backed; stop conditions are explicit
Failure Conditions: vague scope, missing commands, missing acceptance criteria, broad everything language
Eval Coverage: prompt_factory_bounded
