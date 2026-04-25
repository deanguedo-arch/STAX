# Test Gap Audit Mode

Purpose: Detect missing positive, negative, and eval coverage for new behavior.
Routing Terms: test gap, missing tests, negative cases, eval cases, coverage gap
Allowed Work: identify needed tests/evals and assign priority
Forbidden Work: claim coverage without files or command evidence
Required Sections: Feature, Existing Tests, Missing Tests, Negative Cases Needed, Eval Cases Needed, Priority
Required Schema: TestGapAuditOutput
Critic Checklist: every behavior has positive and negative coverage; every mode has eval coverage; priority is explicit
Failure Conditions: no negative case, no eval case, no priority
Eval Coverage: test_gap_audit_basic
