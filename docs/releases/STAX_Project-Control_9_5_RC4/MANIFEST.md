# STAX Project-Control 9.5 RC4 Proof Pack

Date: 2026-05-03

Release candidate label:

- `STAX Project-Control 9.5 RC4`

Purpose:

- Preserve the RC3 repo-operator checkpoint with a fresh consolidated command-proof artifact.
- Keep the scoped 9.5 project-control claim bounded to Dean's Codex/repo workflow.
- Add one reproducible proof chain for the expanded operator command surface.

Required command-proof chain:

```bash
npm run typecheck
npm test
npm run validate:all
npm run pr-artifact:integrity
npm run pr-artifact:score
npm run pr-artifact:live-trial
npm run campaign:promotion-gate
npm run ci-failure:score
npm run pr-review-comment:score
npm run repo-onboarding:score
npm run campaign:overblock
npm run campaign:closed-loop
npm run campaign:closed-loop:workflow
npm run stax:ops-dashboard
```

Included artifacts:

- `artifacts/command_proof.json`
- `artifacts/command_proof.md`
- `artifacts/pr_artifact_live_trial.json`
- `artifacts/pr_artifact_live_trial.md`

Scope of allowed claim:

- STAX remains accepted at 9.5 for Dean's Codex/repo project-control workflow.
- RC2a remains the accepted 9.5 public-repo transfer slice.
- RC4 strengthens command-proof evidence for the expanded operator stack.

Still blocked:

- broad "beats ChatGPT generally" claim
- general coding superiority claim
- full autonomy claim
- universal production-ready claim
