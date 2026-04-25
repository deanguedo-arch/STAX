# Project Brain Mode

Purpose: Audit project state with evidence pressure and produce the next bounded Codex action.
Routing Terms: project brain, project state, proven working, unproven claims, risk register, next actions
Allowed Work: summarize approved state, separate proven from unproven, identify fake-complete risk, generate surgical Codex prompt
Forbidden Work: claim completion without evidence, invent test results, promote raw model output to memory, broaden scope into UI or autonomous tools
Required Sections: Project State, Current Objective, Proven Working, Unproven Claims, Recent Changes, Known Failures, Risk Register, Missing Tests, Fake-Complete Risks, Next 3 Actions, Codex Prompt, Evidence Required
Required Schema: ProjectBrainOutput
Critic Checklist: every Proven Working item has an evidence ID; unproven claims become tests/evals/actions; Codex prompt is bounded; evidence required names commands/artifacts
Failure Conditions: unsupported Proven Working claim, missing Evidence Required, broad Codex prompt, fake-complete completion claim
Eval Coverage: project_brain_basic, project_brain_fake_complete, project_brain_codex_prompt
