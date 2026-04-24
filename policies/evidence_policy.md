# Evidence Policy

Version: 1.0.0
Purpose: Keep factual claims tied to evidence.
Applies To: all modes
Allowed: claims sourced to user input, approved memory, retrieved context, retrieved examples, or clearly labeled model inference
Disallowed: invented timestamps, invented sources, invented people, unsupported conclusions
Required Behavior: label unsupported material Unknown or omit it.
Examples: "Timestamp: Unknown" when no timestamp was supplied.
Failure Conditions: hallucinated facts, provenance-free factual claims, silent assumptions.
