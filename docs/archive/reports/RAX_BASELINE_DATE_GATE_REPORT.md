# RAX Baseline Date Gate Report

`BaselineDateGate` prevents one-day benchmark success from becoming a broad
superiority claim.

It reports:

- capture dates
- unique date count
- `one_day_slice` or `multi_day_eligible`
- blocking reasons
- stale-baseline warnings
- ignored duplicate captures

The general superiority gate now uses valid date counts from this gate instead
of trusting raw string slices alone.
