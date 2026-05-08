# Pending Aggregate Pattern Review

Generated: 2026-05-08T17:20:03.274Z
Pending candidates: 48
Aggregate groups: 5
Promotable aggregate groups: 3

No aggregate is accepted or promoted by this report. Requires human approval: yes.

## agg_codex_handoff_rule

Classification: codex_handoff_rule
Candidate count: 29
Promotable: yes
Recommended queue: codex_prompt_candidate
Promotion target: mode_contract_patch
Requires human approval: yes
Reason: Reusable Codex handoff shape can improve future bounded delegation prompts.
Expected behavior change: Future Codex prompts include repo path, files, commands, acceptance criteria, and stop conditions.
Suggested regression eval: A bounded Codex prompt request should include scope, evidence command, acceptance criteria, and stop condition.
Source candidates: cand_brightspacequizexporter_codex_report_0b661e767015, cand_brightspacequizexporter_codex_report_0e83095f6d14, cand_brightspacequizexporter_codex_report_13d4bb938a39, cand_brightspacequizexporter_codex_report_1512e837cfa0, cand_brightspacequizexporter_codex_report_175327f3dbb2, cand_brightspacequizexporter_codex_report_1ba21c128484, cand_brightspacequizexporter_codex_report_2db8ecbb5322, cand_brightspacequizexporter_codex_report_3642ff0a5fa8, cand_brightspacequizexporter_codex_report_36651f59311f, cand_brightspacequizexporter_codex_report_52ed447cf749, cand_brightspacequizexporter_codex_report_6a13f70b1122, cand_brightspacequizexporter_codex_report_6a2b464089a7, cand_brightspacequizexporter_codex_report_73a900bea8f0, cand_brightspacequizexporter_codex_report_73e90019a7b6, cand_brightspacequizexporter_codex_report_8114fdd2e8f9, cand_brightspacequizexporter_codex_report_8b35f4012bd5, cand_brightspacequizexporter_codex_report_92b4a58f587f, cand_brightspacequizexporter_codex_report_96c6df75c4b8, cand_brightspacequizexporter_codex_report_b1000e988b03, cand_brightspacequizexporter_codex_report_c3be930a60ae, cand_brightspacequizexporter_codex_report_c84cbd81aa07, cand_brightspacequizexporter_codex_report_c8b097733888, cand_brightspacequizexporter_codex_report_cd67e63245ab, cand_brightspacequizexporter_codex_report_e06f1fe10e08, cand_brightspacequizexporter_codex_report_e163bcb27b71, cand_brightspacequizexporter_codex_report_e4df72737a72, cand_brightspacequizexporter_codex_report_f2f3c24f5c9c, cand_brightspacequizexporter_codex_report_fbefb573cea3, cand_brightspacequizexporter_codex_report_fe8d25156853

Examples:
- Codex report from brightspacequizexporter: Confirm the current goal is live format review only, with answer-key cleanup intentionally deferred because the keyed source printout is not available.. Next: Use the live Google Form view link to inspect the student-facing format before doing any answer-key or cropper work.
- Codex report from brightspacequizexporter: - Confirm where the STAX protocol lives for this repo and read it from the repo-local AGENTS.md.. Next: - Add `.stax/status.json` with an explicit verdict contract (`Pass`, `Provisional`, `Reject`, or `Human review`) so turn routing can be enforced automatically.
- Codex report from brightspacequizexporter: Use the new `codex/resume-math30-msforms-20260506` resume branches, read the current STAX handoff, confirm the Brightspace converter files, run `npm ci`, and run the Math 30 conversion from the Brightspace repo.. Next: Resolve the mismatch between the STAX handoff's 27-question/Q9-Q10-Q14 example and the current branch's 23-question/Q5-Q6-Q12-Q23 output before implementing the stronger equation-recognition adapter.
- Codex report from brightspacequizexporter: Identify which Math 30 conversion questions need additional source information from the current reproducible output.. Next: Collect exact source text/equations and correct answers for Q5, Q6, Q12, Q23, plus the Q22 diagram context if this output is the run to repair.
- Codex report from brightspacequizexporter: Try a math-heavy Common Cartridge QTI quiz through the Google Forms visual-prompt route, preserving the equation-heavy formatting as rendered prompt images while keeping Google Forms answer controls underneath.. Next: Open the live Section 3.5 proof form and decide whether this math-heavy visual route is good enough to batch over more QTI quizzes.

## agg_proof_boundary_rule

Classification: proof_boundary_rule
Candidate count: 5
Promotable: yes
Recommended queue: eval_candidate
Promotion target: eval
Requires human approval: yes
Reason: The candidate defines a reusable proof boundary that should be replay-tested.
Expected behavior change: Future answers reject weak proof and demand target-repo command evidence.
Suggested regression eval: Command evidence from the wrong repo must not verify the target repo.
Source candidates: cand_brightspacequizexporter_codex_report_185aee5a3d31, cand_brightspacequizexporter_codex_report_20fdd9bf1c99, cand_brightspacequizexporter_codex_report_3176c45528d1, cand_brightspacequizexporter_codex_report_b733d2321625, cand_brightspacequizexporter_codex_report_d6766c0ae20b

Examples:
- Codex report from brightspacequizexporter: Check whether the newly opened VS Code nightly/insiders environment is missing extensions needed for this repo.. Next: Open the nightly Extensions panel and confirm `ChatGPT - Work with Codex` or `openai.chatgpt` is enabled for this workspace.
- Codex report from brightspacequizexporter: Merge the Math30 Microsoft Forms transfer work into `main`, validate it, push `main`, and clean up completed branches.. Next: Inspect `stash@{0}` separately if the goal is to clear all saved local work too.
- Codex report from brightspacequizexporter: Create a reusable living runbook for the Common Cartridge QTI to Google Forms visual export workflow, covering both proof styles and the current lessons from Math and Chemistry batches without tracking live Google Form URLs.. Next: Review the runbook after the next real QTI batch export and add the result to the Experiment Log.
- Codex report from brightspacequizexporter: Answer whether fast mode or a lower model would materially speed up the planned full Common Cartridge Google Forms batch.. Next: Before the full batch, add or confirm the batch runner settings: choice-text style first, output summary, and optional Drive subfolder organization.
- Codex report from brightspacequizexporter: Answer how to open a browser from the Windows/VS Code/Codex workflow.. Next: Use `Start-Process "<url>"` or `start "<url>"` from PowerShell to open a browser.

## agg_repo_specific_fact

Classification: repo_specific_fact
Candidate count: 7
Promotable: no
Recommended queue: trace_only
Promotion target: none
Requires human approval: yes
Reason: Specific file, package, command, or local state facts are evidence, not durable learning. It remains evidence because it is one-off, low-severity, or repo-specific.
Expected behavior change: No durable behavior change until a reusable pattern is proven.
Suggested regression eval: none
Source candidates: cand_brightspacequizexporter_codex_report_0f3408841e4c, cand_brightspacequizexporter_codex_report_555352c72875, cand_brightspacequizexporter_codex_report_67d094dbb38d, cand_brightspacequizexporter_codex_report_8165ef148148, cand_brightspacequizexporter_codex_report_a5f9be025942, cand_brightspacequizexporter_codex_report_be4b4047c51b, cand_brightspacequizexporter_codex_report_f934a81024c3

Examples:
- Codex report from brightspacequizexporter: Clarify that manual Math 30 overrides must preserve semantic formulas, not just pretty screenshots or plain notes, and update the review intake format accordingly.. Next: Implement a manual override path that reads the canonical formulas and emits them as semantic math segments in the native-math DOCX, with a readable fallback for Quick Import.
- Codex report from brightspacequizexporter: Normalize the user's `QUESTION_PATCH_V1` entries for Q5, Q6, and Q12 into the local Math 30 manual review intake files.. Next: Collect answers for Q6/Q12 and source entries for Q22/Q23, then wire the validated manual patches into the converter.
- Codex report from brightspacequizexporter: Mark Q6 and Q12 as intentionally unkeyed because the user does not currently have the correct answers.. Next: Proceed with formula/text override implementation while leaving Q6 and Q12 out of the answer key.
- Codex report from brightspacequizexporter: Explain the ideal export format for Math 30 questions so they can be imported into Microsoft Forms without losing formula meaning.. Next: Treat the ideal export as a two-track artifact: Forms-friendly Word layout plus canonical linear math source for durable formula rendering/fallback.
- Codex report from brightspacequizexporter: Provide the exact ChatGPT export format the user should request for manually reviewed Math 30 question corrections.. Next: Have the user ask ChatGPT for one question in the specified `QUESTION_PATCH_V1` format, paste it here, and validate that it can be applied cleanly.

## agg_schema_contract_rule

Classification: schema_contract_rule
Candidate count: 6
Promotable: yes
Recommended queue: schema_patch_candidate
Promotion target: schema_patch
Requires human approval: yes
Reason: The candidate describes a structured contract weakness rather than a single result.
Expected behavior change: Future outputs are validated against the stronger schema contract.
Suggested regression eval: Malformed structured output should fail schema validation instead of passing silently.
Source candidates: cand_brightspacequizexporter_codex_report_495fb2178881, cand_brightspacequizexporter_codex_report_6270197e8dce, cand_brightspacequizexporter_codex_report_76a2d3d9282d, cand_brightspacequizexporter_codex_report_9c1547418c87, cand_brightspacequizexporter_codex_report_c1ebdcf4dde5, cand_brightspacequizexporter_codex_report_fe172119557e

Examples:
- Codex report from brightspacequizexporter: Implement the Math 30 manual patch path so reviewed question text/formulas can be applied to the Microsoft Forms export, preserving formulas in native DOCX output and leaving unknown answers unkeyed.. Next: Open/import `C:\Users\DEAN~1.GUE\AppData\Local\Temp\brightspace-msforms-manual.e8e6e2\quiz.msforms.quickimport.docx` into Microsoft Forms and inspect Q5/Q6/Q12/Q22/Q23 rendering before claiming Forms import success.
- Codex report from brightspacequizexporter: Apply the user's additional Math 30 Microsoft Forms corrections for Q1, Q2, Q9, Q10, and Q14, regenerate the DOCX, and verify those wrapped prompt/formula failures are fixed.. Next: Import `C:\Users\DEAN~1.GUE\AppData\Local\Temp\brightspace-msforms-reviewed.db2f58\quiz.msforms.quickimport.docx` into Microsoft Forms and inspect Q1, Q2, Q9, Q10, and Q14 first.
- Codex report from brightspacequizexporter: Run the Common Cartridge QTI quizzes through the Google Forms visual-prompt route in choice-text proof format, fix the discovered MathML linebreak rendering bug, and commit/push the converter work.. Next: Inspect the 21 bridge-validation failures and surface their diagnostics so the remaining Common Cartridge quizzes can be sent without guessing.
- Codex report from brightspacequizexporter: Try option 1 on one Common Cartridge quiz: render QTI prompts as images from cartridge content/assets and place real Google Forms answer controls underneath.. Next: Open the live proof form and decide whether this cartridge-derived visual prompt route is good enough to turn into the batch converter.
- Codex report from brightspacequizexporter: Apply the user's reviewed weird-format fixes for the Math 30 Microsoft Forms export, regenerate the DOCX, and verify the export no longer contains Brightspace print chrome or raw LaTeX math.. Next: Import `C:\Users\DEAN~1.GUE\AppData\Local\Temp\brightspace-msforms-reviewed.717ccd\quiz.msforms.quickimport.docx` into Microsoft Forms and inspect Q4, Q6, Q11, Q13, Q15, and Q19 first.

## agg_trace_fact

Classification: trace_fact
Candidate count: 1
Promotable: no
Recommended queue: trace_only
Promotion target: none
Requires human approval: yes
Reason: This is a one-off observation. It remains evidence because it is one-off, low-severity, or repo-specific.
Expected behavior change: No durable behavior change until a reusable pattern is proven.
Suggested regression eval: none
Source candidates: cand_brightspacequizexporter_codex_report_854370325536

Examples:
- Codex report from brightspacequizexporter: Answer whether VS Code/nightly has an integrated browser and how to open it.. Next: Use Command Palette and run `Simple Browser: Show`, then paste the URL.
