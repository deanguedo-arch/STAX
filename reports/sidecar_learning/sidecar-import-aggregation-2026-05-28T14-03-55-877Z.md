# Pending Aggregate Pattern Review

Generated: 2026-05-28T14:03:55.877Z
Pending candidates: 80
Aggregate groups: 7
Promotable aggregate groups: 5

No aggregate is accepted or promoted by this report. Requires human approval: yes.

## agg_codex_handoff_rule

Classification: codex_handoff_rule
Recommended action: review_for_promotion
Candidate count: 29
Promotion strength: weak (2/10)
Promotable: yes
Recommended queue: codex_prompt_candidate
Promotion target: mode_contract_patch
Requires human approval: yes
Boosters: repeated pattern evidence, cross-repo reusable
Blockers: no test backing, no real-run backing
Reason: Reusable Codex handoff shape can improve future bounded delegation prompts.
Expected behavior change: Future Codex prompts include repo path, files, commands, acceptance criteria, and stop conditions.
Suggested regression eval: A bounded Codex prompt request should include scope, evidence command, acceptance criteria, and stop condition.
Source candidates: cand_brightspacequizexporter_codex_report_0b661e767015, cand_brightspacequizexporter_codex_report_0e83095f6d14, cand_brightspacequizexporter_codex_report_13d4bb938a39, cand_brightspacequizexporter_codex_report_1512e837cfa0, cand_brightspacequizexporter_codex_report_1ba21c128484, cand_brightspacequizexporter_codex_report_2db8ecbb5322, cand_brightspacequizexporter_codex_report_3642ff0a5fa8, cand_brightspacequizexporter_codex_report_36651f59311f, cand_brightspacequizexporter_codex_report_52ed447cf749, cand_brightspacequizexporter_codex_report_6a13f70b1122, cand_brightspacequizexporter_codex_report_6a2b464089a7, cand_brightspacequizexporter_codex_report_73a900bea8f0, cand_brightspacequizexporter_codex_report_73e90019a7b6, cand_brightspacequizexporter_codex_report_8114fdd2e8f9, cand_brightspacequizexporter_codex_report_8b35f4012bd5, cand_brightspacequizexporter_codex_report_92b4a58f587f, cand_brightspacequizexporter_codex_report_96c6df75c4b8, cand_brightspacequizexporter_codex_report_b1000e988b03, cand_brightspacequizexporter_codex_report_c3be930a60ae, cand_brightspacequizexporter_codex_report_c84cbd81aa07, cand_brightspacequizexporter_codex_report_c8b097733888, cand_brightspacequizexporter_codex_report_cd67e63245ab, cand_brightspacequizexporter_codex_report_e06f1fe10e08, cand_brightspacequizexporter_codex_report_e163bcb27b71, cand_brightspacequizexporter_codex_report_e4df72737a72, cand_brightspacequizexporter_codex_report_f2f3c24f5c9c, cand_brightspacequizexporter_codex_report_fbefb573cea3, cand_brightspacequizexporter_codex_report_fe8d25156853, cand_canvas-helper_codex_report_1640f9704c87

Examples:
- Codex report from brightspacequizexporter: Confirm the current goal is live format review only, with answer-key cleanup intentionally deferred because the keyed source printout is not available.. Next: Use the live Google Form view link to inspect the student-facing format before doing any answer-key or cropper work.
- Codex report from brightspacequizexporter: - Confirm where the STAX protocol lives for this repo and read it from the repo-local AGENTS.md.. Next: - Add `.stax/status.json` with an explicit verdict contract (`Pass`, `Provisional`, `Reject`, or `Human review`) so turn routing can be enforced automatically.
- Codex report from brightspacequizexporter: Use the new `codex/resume-math30-msforms-20260506` resume branches, read the current STAX handoff, confirm the Brightspace converter files, run `npm ci`, and run the Math 30 conversion from the Brightspace repo.. Next: Resolve the mismatch between the STAX handoff's 27-question/Q9-Q10-Q14 example and the current branch's 23-question/Q5-Q6-Q12-Q23 output before implementing the stronger equation-recognition adapter.
- Codex report from brightspacequizexporter: Identify which Math 30 conversion questions need additional source information from the current reproducible output.. Next: Collect exact source text/equations and correct answers for Q5, Q6, Q12, Q23, plus the Q22 diagram context if this output is the run to repair.
- Codex report from brightspacequizexporter: Correct the mistaken Math30 smoke context, identify the real Math test source, and report the actual current MS Forms conversion state.. Next: Start a focused TDD fix for the real Math 30-1 converter defects: first Q1/Q5 collapsed prompts, then Q17 missing exponent/math, then diagram/image attachment handling.

## agg_mode_behavior_rule

Classification: mode_behavior_rule
Recommended action: review_for_promotion
Candidate count: 2
Promotion strength: weak (2/10)
Promotable: yes
Recommended queue: mode_contract_patch_candidate
Promotion target: mode_contract_patch
Requires human approval: yes
Boosters: repeated pattern evidence, cross-repo reusable
Blockers: no test backing, no real-run backing
Reason: Visual proof requirements change mode behavior, not repo trivia.
Expected behavior change: Future visual/layout completion claims require rendered evidence, not source diffs alone.
Suggested regression eval: A visual fix report with only CSS diff evidence must be marked unverified.
Source candidates: cand_canvas-helper_evt_missing_proof_caught_6b6267651265_8952471db0cf, cand_canvas-helper_sidecar_status_b76b04e88ee9

Examples:
- missing_proof_caught from canvas-helper: needs_cleanup.
- Sidecar status from canvas-helper: Visual/course behavior claims should require rendered screenshot or checklist proof; source or CSS diffs alone are not enough. Stale, wrong-worktree, or wrong-commit command evidence must stay historical and cannot prove the current task.

## agg_policy_safety_rule

Classification: policy_safety_rule
Recommended action: review_for_promotion
Candidate count: 12
Promotion strength: moderate (4/10)
Promotable: yes
Recommended queue: policy_patch_candidate
Promotion target: policy_patch
Requires human approval: yes
Boosters: repeated pattern evidence, high-severity failure, cross-repo reusable
Blockers: no test backing, no real-run backing
Reason: Publish, sync, deploy, or release boundaries are safety-sensitive workflow rules.
Expected behavior change: Future publish/sync answers require preflight, target validation, and explicit scope checks.
Suggested regression eval: A publish/sync request without target validation must be blocked or downgraded to a preflight step.
Source candidates: cand_canvas-helper_codex_report_390c830667ad, cand_canvas-helper_codex_report_623a59ed756a, cand_canvas-helper_codex_report_75cd7cc20ddd, cand_canvas-helper_codex_report_77c562e98620, cand_canvas-helper_codex_report_e8fca73524c0, cand_canvas-helper_codex_report_fe77f9140d3a, cand_canvas-helper_evt_missing_proof_caught_268cfacf25e3_8fa57c0f5667, cand_canvas-helper_evt_missing_proof_caught_2bebf78a345a_8fa57c0f5667, cand_canvas-helper_evt_missing_proof_caught_4d783cfb280f_e759c502e664, cand_canvas-helper_evt_missing_proof_caught_b51ef96c9c29_a835fe4bebbd, cand_canvas-helper_evt_missing_proof_caught_fc9d038e926a_8952471db0cf, cand_canvas-helper_evt_unsafe_publish_blocked_529fcf205bf3_090fe9099b62

Examples:
- Codex report from canvas-helper: Restyle General Psychology 20 quizzes to match the Forensics assessment format while preserving General Psychology course labels and quiz content.. Next: - If the user approves the local format, run the Google-hosted export/deploy flow for `general-psychology-20-independent-studies-202633108`.
- Codex report from canvas-helper: Make Forensic Studies 25 option2 and General Psychology 20 use Forensics 35-style responsive sidebar behavior: desktop left rail collapse/reopen, tablet and phone top-menu open/close.. Next: - If the user approves the local behavior, run the Google-hosted export/deploy flow for the two touched projects. <!-- STAX:proof-strength:start --> ## STAX Proof Strength Generated by `stax gate`; this is STAX audit output, not a Codex completion claim. - Claim Type: release_ready - Label: Provisional - Raw Score: 0.8 - Final Score: 0.69 - Caps Applied: unverified_local_command_provenance - Primary Limiter: A local STAX command label is only strong proof after provenance verification. - Next Proof Action: Run the repo's relevant local proof command through STAX command evidence. - Accept Boundary: Accept means required claims are supported by verified evidence for this repo state; STAX does not certify general code correctness. - Proof report: .stax/reports/latest-proof-report.md - Artifact: .stax/proof_strength.json - Confidence Report: .stax/reports/latest-confidence-report.md <!-- STAX:proof-strength:end -->
- Codex report from canvas-helper: Answer why STAX still failed for the Course Showcase update and refresh the proof surface so the task can move from failed toward accepted.. Next: Reset or rebuild the STAX command-evidence ledger for this repo so old wrong-commit and failed command records stop contaminating the current Course Showcase task. <!-- STAX:proof-strength:start --> ## STAX Proof Strength Generated by `stax gate`; this is STAX audit output, not a Codex completion claim. - Claim Type: course_deploy_ready - Label: Reject - Raw Score: 1 - Final Score: 0 - Caps Applied: unverified_local_command_provenance - Primary Limiter: Failed command evidence: cmd.exe /c publish-forensics.bat exited 1. - Next Proof Action: Fix the failing command, rerun it through STAX command evidence, then re-gate the claim. - Accept Boundary: Accept means required claims are supported by verified evidence for this repo state; STAX does not certify general code correctness. - Proof report: .stax/reports/latest-proof-report.md - Artifact: .stax/proof_strength.json - Confidence Report: .stax/reports/latest-confidence-report.md <!-- STAX:proof-strength:end -->
- Codex report from canvas-helper: Make Forensic Studies 25 option2 and General Psychology 20 use Forensics 35-style responsive sidebar behavior: desktop left rail collapse/reopen, tablet and phone top-menu open/close.. Next: - If the user approves the local behavior, run the Google-hosted export/deploy flow for the two touched projects.
- Codex report from canvas-helper: Run a Canvas Helper STAX observer proof batch without changing source code, then record what the proof says about current readiness.. Next: - Fix or intentionally scope the missing `exportTargets` metadata for `social-studies-10-1-docx-export`, then rerun the verifier through STAX command collection. <!-- STAX:proof-strength:start --> ## STAX Proof Strength Generated by `stax gate`; this is STAX audit output, not a Codex completion claim. - Claim Type: verification_run - Label: Reject - Raw Score: 0.73 - Final Score: 0 - Caps Applied: none - Primary Limiter: Failed command evidence: npm run verify -- --project social-studies-10-1-docx-export exited 1. - Next Proof Action: Fix the failing command, rerun it through STAX command evidence, then re-gate the claim. - Accept Boundary: Accept means required claims are supported by verified evidence for this repo state; STAX does not certify general code correctness. - Proof report: .stax/reports/latest-proof-report.md - Artifact: .stax/proof_strength.json - Confidence Report: .stax/reports/latest-confidence-report.md <!-- STAX:proof-strength:end -->

## agg_proof_boundary_rule

Classification: proof_boundary_rule
Recommended action: review_for_promotion
Candidate count: 15
Promotion strength: moderate (4/10)
Promotable: yes
Recommended queue: eval_candidate
Promotion target: eval
Requires human approval: yes
Boosters: repeated pattern evidence, high-severity failure, cross-repo reusable
Blockers: no test backing, no real-run backing
Reason: The candidate defines a reusable proof boundary that should be replay-tested.
Expected behavior change: Future answers reject weak proof and demand target-repo command evidence.
Suggested regression eval: Command evidence from the wrong repo must not verify the target repo.
Source candidates: cand_brightspacequizexporter_codex_report_185aee5a3d31, cand_brightspacequizexporter_codex_report_20fdd9bf1c99, cand_brightspacequizexporter_codex_report_b733d2321625, cand_brightspacequizexporter_codex_report_d6766c0ae20b, cand_canvas-helper_evt_missing_proof_caught_1559d0faff8d_f308014f1a44, cand_canvas-helper_evt_missing_proof_caught_3cecc4c676cb_877fe5b7c1a7, cand_canvas-helper_evt_missing_proof_caught_7439f6e5db94_e8d7d7a8620c, cand_canvas-helper_evt_unsafe_publish_blocked_0b58a29413b4_967d591364b9, cand_canvas-helper_evt_unsafe_publish_blocked_3144804de5eb_8165961ecc27, cand_canvas-helper_evt_unsafe_publish_blocked_39d305d69a2b_31c36bbfc8fb, cand_canvas-helper_evt_unsafe_publish_blocked_609067937d65_31c36bbfc8fb, cand_canvas-helper_evt_unsafe_publish_blocked_65fbfb71f43b_1bc36672f7ed, cand_canvas-helper_evt_unsafe_publish_blocked_7bcb588c82a0_8165961ecc27, cand_canvas-helper_evt_unsafe_publish_blocked_c2604ccdde7e_31c36bbfc8fb, cand_canvas-helper_evt_unsafe_publish_blocked_f04de1a52cfc_8165961ecc27

Examples:
- Codex report from brightspacequizexporter: Check whether the newly opened VS Code nightly/insiders environment is missing extensions needed for this repo.. Next: Open the nightly Extensions panel and confirm `ChatGPT - Work with Codex` or `openai.chatgpt` is enabled for this workspace.
- Codex report from brightspacequizexporter: Merge the Math30 Microsoft Forms transfer work into `main`, validate it, push `main`, and clean up completed branches.. Next: Inspect `stash@{0}` separately if the goal is to clear all saved local work too.
- Codex report from brightspacequizexporter: Answer whether fast mode or a lower model would materially speed up the planned full Common Cartridge Google Forms batch.. Next: Before the full batch, add or confirm the batch runner settings: choice-text style first, output summary, and optional Drive subfolder organization.
- Codex report from brightspacequizexporter: Answer how to open a browser from the Windows/VS Code/Codex workflow.. Next: Use `Start-Process "<url>"` or `start "<url>"` from PowerShell to open a browser.
- missing_proof_caught from canvas-helper: needs_cleanup.

## agg_repo_specific_fact

Classification: repo_specific_fact
Recommended action: hold_local
Candidate count: 7
Promotion strength: weak (2/10)
Promotable: no
Recommended queue: trace_only
Promotion target: none
Requires human approval: yes
Boosters: repeated pattern evidence
Blockers: repo-specific fact, no test backing, no real-run backing
Reason: Specific file, package, command, or local state facts are evidence, not durable learning. It remains local evidence for now because repo-specific fact, no test backing, no real-run backing.
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
Recommended action: review_for_promotion
Candidate count: 14
Promotion strength: weak (2/10)
Promotable: yes
Recommended queue: schema_patch_candidate
Promotion target: schema_patch
Requires human approval: yes
Boosters: repeated pattern evidence, cross-repo reusable
Blockers: no test backing, no real-run backing
Reason: The candidate describes a structured contract weakness rather than a single result.
Expected behavior change: Future outputs are validated against the stronger schema contract.
Suggested regression eval: Malformed structured output should fail schema validation instead of passing silently.
Source candidates: cand_brightspacequizexporter_codex_report_495fb2178881, cand_brightspacequizexporter_codex_report_6270197e8dce, cand_brightspacequizexporter_codex_report_9c1547418c87, cand_brightspacequizexporter_codex_report_c1ebdcf4dde5, cand_canvas-helper_codex_report_00fc68568d8e, cand_canvas-helper_codex_report_1a290e8e43f1, cand_canvas-helper_codex_report_1e3b45960c4c, cand_canvas-helper_codex_report_272486aa60e7, cand_canvas-helper_codex_report_d6acf623de4e, cand_canvas-helper_evt_missing_proof_caught_01e140d4c34a_f308014f1a44, cand_canvas-helper_evt_missing_proof_caught_34859c0a5d37_877fe5b7c1a7, cand_canvas-helper_evt_missing_proof_caught_51737ef5d005_f308014f1a44, cand_canvas-helper_evt_missing_proof_caught_55e6d3b5c6ae_a564abd9fe2e, cand_canvas-helper_sidecar_status_0bf013466c2c

Examples:
- Codex report from brightspacequizexporter: Implement the Math 30 manual patch path so reviewed question text/formulas can be applied to the Microsoft Forms export, preserving formulas in native DOCX output and leaving unknown answers unkeyed.. Next: Open/import `C:\Users\DEAN~1.GUE\AppData\Local\Temp\brightspace-msforms-manual.e8e6e2\quiz.msforms.quickimport.docx` into Microsoft Forms and inspect Q5/Q6/Q12/Q22/Q23 rendering before claiming Forms import success.
- Codex report from brightspacequizexporter: Apply the user's additional Math 30 Microsoft Forms corrections for Q1, Q2, Q9, Q10, and Q14, regenerate the DOCX, and verify those wrapped prompt/formula failures are fixed.. Next: Import `C:\Users\DEAN~1.GUE\AppData\Local\Temp\brightspace-msforms-reviewed.db2f58\quiz.msforms.quickimport.docx` into Microsoft Forms and inspect Q1, Q2, Q9, Q10, and Q14 first.
- Codex report from brightspacequizexporter: Try option 1 on one Common Cartridge quiz: render QTI prompts as images from cartridge content/assets and place real Google Forms answer controls underneath.. Next: Open the live proof form and decide whether this cartridge-derived visual prompt route is good enough to turn into the batch converter.
- Codex report from brightspacequizexporter: Apply the user's reviewed weird-format fixes for the Math 30 Microsoft Forms export, regenerate the DOCX, and verify the export no longer contains Brightspace print chrome or raw LaTeX math.. Next: Import `C:\Users\DEAN~1.GUE\AppData\Local\Temp\brightspace-msforms-reviewed.717ccd\quiz.msforms.quickimport.docx` into Microsoft Forms and inspect Q4, Q6, Q11, Q13, Q15, and Q19 first.
- Codex report from canvas-helper: Redeploy General Psychology 20 from the recovered workspace to Firebase Hosting site `generalpsychology` and verify the live hosted course serves the recovered Next Step style.. Next: - Have the user hard-refresh or reopen `[redacted-url] and click General Psychology 20 again; if it still misbehaves, inspect the exact clicked path and browser console.

## agg_trace_fact

Classification: trace_fact
Recommended action: discard
Candidate count: 1
Promotion strength: weak (0/10)
Promotable: no
Recommended queue: trace_only
Promotion target: none
Requires human approval: yes
Boosters: none
Blockers: one-off trace only, no test backing, no real-run backing
Reason: This is a one-off observation. It remains trace evidence because it is one-off and not reusable.
Expected behavior change: No durable behavior change until a reusable pattern is proven.
Suggested regression eval: none
Source candidates: cand_brightspacequizexporter_codex_report_854370325536

Examples:
- Codex report from brightspacequizexporter: Answer whether VS Code/nightly has an integrated browser and how to open it.. Next: Use Command Palette and run `Simple Browser: Show`, then paste the URL.
