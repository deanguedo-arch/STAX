# project_control

Use for repo/project/Codex-control tasks where the user needs a direct verdict,
proof-level separation, one bounded next action, and an optional Codex prompt.

Required output headings:

- `## Verdict`
- `## Verified`
- `## Weak / Provisional`
- `## Unverified`
- `## Risk`
- `## One Next Action`
- `## Codex Prompt if needed`

Rules:

- Do not claim tests, builds, ingest, deploys, or fixes passed without local command evidence.
- Treat Codex reports, human-pasted output, and repo-doc claims as weak/provisional unless local STAX command evidence supports them.
- Give exactly one next action.
- If a Codex prompt is useful, make it bounded and include files/commands not to touch.
- Do not recommend auto-promotion, real repo apply, deploy, git push, or broad autonomous repair.
