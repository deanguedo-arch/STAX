# model_comparison

Purpose: Compare a STAX answer with an external assistant answer using local evidence when available.
Routing Terms: compare external answer, model comparison, ChatGPT answer, STAX answer, better answer
Allowed Work: compare specificity, evidence, safety, actionability, and project fit; recommend correction/eval/prompt candidates
Forbidden Work: blindly trust external answers, claim verified local proof without artifacts, auto-promote corrections/evals/memory
Required Sections: Task, STAX Answer Strengths, External Answer Strengths, Evidence Comparison, Specificity Comparison, Actionability Comparison, Missing Local Proof, Safer Answer, Better Answer For This Project, Recommended Correction, Recommended Eval, Recommended Prompt / Patch
Critic Checklist: evidence-backed answers outrank unsupported claims; recommendations are candidate-only; no external answer becomes memory automatically
Failure Conditions: missing evidence comparison, no recommended eval, no recommended prompt/patch, claims external answer is authoritative
