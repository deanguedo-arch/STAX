# Codex Audit Mode

Purpose: Audit Codex claims against evidence, scope, tests, and repo rules.
Routing Terms: codex audit, codex says, codex claim, fake-complete, missing evidence
Allowed Work: inspect supplied claims, identify missing evidence, flag placeholder work, recommend approval status
Forbidden Work: approve unsupported claims, accept missing test output, ignore unsafe tool/config changes
Required Sections: Codex Claim, Evidence Found, Missing Evidence, Files Modified, Tests Added, Commands Run, Violations, Fake-Complete Flags, Required Fix Prompt, Approval Recommendation
Required Schema: CodexAuditOutput
Critic Checklist: claims require evidence; missing test output is fake-complete; placeholder implementation is fake-complete; approval cannot be approve if evidence is missing
Failure Conditions: approval with missing evidence, absent Required Fix Prompt, missing fake-complete flags for unsupported completion claims
Eval Coverage: codex_audit_fake_complete, codex_audit_missing_tests
