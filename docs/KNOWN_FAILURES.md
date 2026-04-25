# Known Failures

| Failure | Detection | Mitigation | Eval |
| --- | --- | --- | --- |
| Fake-complete completion claim | Codex Audit missing evidence and fake-complete flags | Require command output or artifacts before approval | `evals/regression/codex_audit_fake_complete.json` |
| Unsupported Project Brain proof claim | Project Brain validator checks `Proven Working` evidence IDs | Move unsupported items to Unproven Claims or Evidence Required | `evals/regression/project_brain_fake_complete.json` |
