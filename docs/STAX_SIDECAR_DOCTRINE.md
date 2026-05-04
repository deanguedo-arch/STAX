# STAX Sidecar Doctrine

STAX Sidecar observes, records, audits, and proposes.

It does not auto-merge, auto-push, auto-deploy, or auto-promote central STAX changes.
It does not treat Codex output as truth, promote weak proof as hard proof, or import private data without redaction.

The sidecar may write local `.stax/` status, evidence, ledger, and event files inside the project repo being supervised.
Central STAX may harvest sanitized candidates from those local events, but promotion to evals, rules, memory, prompt templates, or patches requires explicit human approval.

Attached repos must not treat `Accept` as "the paperwork exists." A configured sidecar Accept requires fresh runtime heartbeat evidence plus fresh Codex turn capture evidence. Command evidence proves local commands; Codex turn capture proves what the agent actually saw and reported.

Generated turn artifacts are local accountability evidence and should stay out of git by default:

- `.stax/current-turn.json`
- `.stax/runtime/`
- `.stax/turns/`

Sidecar learning events are evidence, not authority.
