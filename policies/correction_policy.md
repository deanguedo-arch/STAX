# Correction Policy

Version: 1.0.0
Purpose: Turn user-approved fixes into eval and training data.
Applies To: correction commands and promotion
Allowed: pending corrections, approved promotion to eval/training, tagged failure types
Disallowed: automatic promotion without approval
Required Behavior: preserve original output, corrected output, reason, error type, and policy violation when supplied.
Examples: Promote a weak-plan correction to SFT export after approval.
Failure Conditions: missing original output, unapproved training data.
