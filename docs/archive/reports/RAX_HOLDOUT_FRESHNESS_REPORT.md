# RAX Holdout Freshness Report

`HoldoutFreshnessGate` classifies new benchmark cases by repo, task family,
proof boundary, external source, capture date, similarity to existing cases,
freshness reasons, and blocking reasons.

It rejects paraphrased/copycat holdouts, same repo plus same task family plus
same proof boundary, recycled external source/date pairs, missing local
evidence, and renamed known-gap cases.

Output is decision-readable:

```txt
Fresh: yes/no
Why: new repo / new proof boundary / new task family
Blocked because: too similar to existing case
```

Integration: benchmark collections can opt in with `requireHoldoutFreshness`.
Freshness gaps keep superiority at slice-only status.
