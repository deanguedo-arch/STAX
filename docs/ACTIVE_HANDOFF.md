# Active Handoff

Date: 2026-05-06

## Current Workstream

Resume the Brightspace Math 30 print-PDF to Microsoft Forms transfer work.

Primary handoff:

- `docs/handoffs/MATH30_BRIGHTSPACE_MFORMS_ACTIVE_HANDOFF.md`

Source repo:

- `/Users/deanguedo/Documents/GitHub/brightspacequizexporter`

STAX repo:

- `/Users/deanguedo/Documents/GitHub/STAX`

## Current State

The Brightspace repo now has the Microsoft Forms converter work committed and available from GitHub.

Use this branch on a new computer:

- repo: `deanguedo-arch/brightspacequizexporter`
- branch: `codex/resume-math30-msforms-20260506`
- current merged main commit: `d752119f7a3f8866f820afddfffc3c1c6964f664`
- original converter commit: `4a806ef`

The committed Brightspace implementation includes:

- `brightspaceexport convert`
- Brightspace print-PDF region segmentation
- glyph-geometry math recovery
- Microsoft Forms Quick Import DOCX output
- native Word math DOCX output
- canonical `quiz.question_bank.json`
- warnings/lint artifacts
- governed math-region crop OCR/vision recovery

Important transport note:

- Do not look for the old feature branch if it was deleted after merge.
- Use `origin/main` or `codex/resume-math30-msforms-20260506` in the Brightspace repo.
- The STAX handoff branch only carries handoff/proof context. The executable converter code lives in the Brightspace repo.

## Latest Verified Example

Input PDF:

- `/Users/deanguedo/Downloads/Print Quiz - 25-26 _ S2 _ Mathematics 30-2 _ Per 1(A) _ Sec SPO2.pdf`

Latest example output:

- `/tmp/brightspace-msforms-example.lHnd2Y`

Generated:

- `/tmp/brightspace-msforms-example.lHnd2Y/quiz.msforms.quickimport.docx`
- `/tmp/brightspace-msforms-example.lHnd2Y/quiz.msforms.native-math.docx`
- `/tmp/brightspace-msforms-example.lHnd2Y/quiz.question_bank.json`
- `/tmp/brightspace-msforms-example.lHnd2Y/quiz.extraction_warnings.json`
- `/tmp/brightspace-msforms-example.lHnd2Y/quiz.forms_lint.txt`
- `/tmp/brightspace-msforms-example.lHnd2Y/quiz.math_region_artifacts.json`

Result:

- 27 questions total
- 16 multiple-choice
- 8 numerical-response
- 3 written-response
- 7 safe glyph-math recoveries
- 3 governed OCR attempts rejected

## Key Finding

Local OCR is too weak for Q9, Q10, and Q14:

- Q9 rejected: confidence 0.71 below 0.90
- Q10 rejected: confidence 0.77 below 0.90
- Q14 rejected: no equation-shaped math candidate

This is correct behavior. Weak OCR must not be attached as semantic math.

## Fresh Thread Prompt

Use this exact prompt on the next computer:

```txt
docs/ACTIVE_HANDOFF.md

We are resuming the Math 30 Brightspace print-PDF to Microsoft Forms transfer work.

First read:
- /Users/deanguedo/Documents/GitHub/STAX/docs/ACTIVE_HANDOFF.md
- /Users/deanguedo/Documents/GitHub/STAX/docs/handoffs/MATH30_BRIGHTSPACE_MFORMS_ACTIVE_HANDOFF.md

Then open:
- /Users/deanguedo/Documents/GitHub/brightspacequizexporter

Goal:
Continue from the exact current state of the Microsoft Forms converter. The current blocker is Q9/Q10/Q14 math recovery from rendered question-region crops. Do not weaken warning gates. Do not attach OCR/vision math unless it is equation-shaped and confidence is at least 0.90. Keep unresolved crops/warnings when confidence is weak.

Before coding:
1. Fetch and switch the Brightspace resume branch `codex/resume-math30-msforms-20260506`, or pull current `origin/main`.
2. Confirm `scripts/brightspaceexport.ts` and `src/ingest/msforms/` are present.
3. Run the latest example command from the handoff and inspect `quiz.forms_lint.txt`, `quiz.question_bank.json`, and `quiz.math_region_artifacts.json`.

Next implementation target:
Plug in a stronger equations-only vision recognizer for Q9/Q10/Q14 via `MSFORMS_MATH_REGION_VISION_CMD`, or add a governed recognizer adapter that produces `{ "equation": "...", "confidence": 0.xx, "engine": "..." }`.

Validation:
- run the exact Math 30 PDF conversion
- verify Q9/Q10/Q14 decisions in `quiz.math_region_artifacts.json`
- run `npm run build`
- run `npm test`
- run `npm run ingest:ci`
- run `npm run lint` and report the known unrelated lint blockers if still present

Do not claim Microsoft Forms import success until the generated DOCX has actually been imported into Microsoft Forms.
Do not promote any STAX learning candidate unless Dean explicitly approves it.
```

## STAX Update

This handoff also creates a pending STAX sidecar import candidate:

- `queues/sidecar_imports/pending/cand_brightspace_math30_msforms_transfer_2026_05_06.json`

It is a `repo_memory` candidate and requires explicit human approval before promotion.

## Stop Condition

The next session can stop once it has either:

- recovered Q9/Q10/Q14 with governed high-confidence equation recognition and rerun the gates, or
- proved that the current recognizer cannot recover them and left clear crop artifacts plus warnings for manual correction.
