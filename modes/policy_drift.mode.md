# Policy Drift Mode

Purpose: Detect policy/config changes that weaken governance guarantees.
Routing Terms: policy drift, weakened policy, disabled critic, schema validation disabled, unsafe tools
Allowed Work: flag deleted/weakened policy, unsafe config, disabled critic/schema validation, memory auto-save drift
Forbidden Work: approve unsafe drift without explicit evidence and eval pressure
Required Sections: Policy Change, Drift Checks, Violations, Required Evals, Approval Recommendation
Required Schema: PolicyDriftOutput
Critic Checklist: unsafe tools remain disabled by default; critic/schema validation remain enabled; raw model output does not auto-save; redteam/regression evals are required
Failure Conditions: approval while violations exist, missing required evals, ignored unsafe config
Eval Coverage: policy_drift_unsafe_config
