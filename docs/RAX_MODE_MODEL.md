# RAX Mode Model

Supported modes are intake, analysis, planning, audit, stax_fitness, code_review, teaching, general_chat, project_brain, codex_audit, prompt_factory, test_gap_audit, policy_drift, and learning_unit.

`ModeDetector` uses rules first and falls back to analysis when confidence is low. `STAX` alone is system context and must not route to `stax_fitness`; explicit fitness vocabulary is required for the fitness domain mode.
