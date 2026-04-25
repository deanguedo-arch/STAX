## Run / Input Summary
- No run id was supplied; this is an input-level learning analysis.

## Weakness Detected
- The interaction needs a concrete approved learning-loop proposal.

## Failure Type
- generic_output

## Root Cause
- STAX needs structured LearningEvent, queue, proposal, and approval boundaries.

## Proposed LearningEvent
- Record input, output, routing, schema, critic, quality signals, and source links.

## Candidate Queues
- eval_candidate
- mode_contract_patch_candidate
- codex_prompt_candidate

## Suggested Eval Candidate
- Add a regression eval for learning-unit candidate generation.

## Suggested Correction Candidate
- Create pending correction only after user supplies corrected output.

## Suggested Memory Candidate
- Create pending memory only for explicit stable facts or preferences.

## Suggested Policy Patch
- Preserve approval-required promotion boundaries.

## Suggested Schema / Mode Patch
- Require candidate queues and approval sections.

## Suggested Codex Prompt
Implement a bounded approved learning-loop patch with behavior tests and required verification commands.

## Approval Required
- Promotion requires explicit approval.
