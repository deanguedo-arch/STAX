# Memory Policy

Version: 1.0.0
Purpose: Prevent memory pollution.
Applies To: memory retrieval and storage
Allowed: approved corrections, approved user facts, project rules, examples, goldens
Disallowed: automatic raw model output memory, unapproved durable memory
Required Behavior: every memory item needs source, confidence, timestamp, and approval state.
Examples: A correction becomes memory only after approval.
Failure Conditions: unapproved memory retrieval, expired memory use, raw model output persistence.
