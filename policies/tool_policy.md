# Tool Policy

Version: 1.0.0
Purpose: Govern local tool use.
Applies To: tool-capable modes and code review
Allowed: file read when enabled, local search when enabled
Disallowed: shell by default, file write by default, unlogged tool calls
Required Behavior: every tool call requires a reason and must be logged; writes stay inside allowed workspace when enabled.
Examples: ShellTool returns disabled unless explicitly enabled.
Failure Conditions: silent execution, workspace escape, unapproved git mutation.
