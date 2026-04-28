# RAX Judgment Packet Report

`JudgmentPacketBuilder` creates human decision packets without executing the
decision.

Packets include:

- decision needed
- options
- recommendation
- evidence available and missing
- risk if approved
- risk if rejected
- irreversibility
- `requiresHumanApproval: true`

This supports sync, report acceptance, promotion, sandbox apply, risky command,
and deploy decisions without bypassing Dean.
