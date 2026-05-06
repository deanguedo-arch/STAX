# Math 30 Brightspace To Microsoft Forms Active Handoff

Date: 2026-05-06

## Purpose

This handoff preserves the exact state of the Math 30 Brightspace print-PDF salvage pipeline so another computer can resume the Microsoft Forms transfer work without replaying the whole conversation.

The target workflow is:

```txt
Brightspace Print PDF
-> positioned PDF text/glyph extraction
-> region-level question segmentation
-> math reconstruction
-> canonical question_bank.json
-> Microsoft Forms-safe DOCX
-> warnings and crop artifacts for unresolved math
```

## Repos

STAX repo:

- `/Users/deanguedo/Documents/GitHub/STAX`
- resume branch: `codex/resume-math30-msforms-20260506`
- current main commit at correction time: `d6d1e1032a36ff77ef1fc6ec742cf7493335ace5`

Brightspace repo:

- `/Users/deanguedo/Documents/GitHub/brightspacequizexporter`
- resume branch: `codex/resume-math30-msforms-20260506`
- current main commit at correction time: `d752119f7a3f8866f820afddfffc3c1c6964f664`
- original converter commit: `4a806ef`

Important:

- The converter implementation is committed in the Brightspace repo and is present on current `origin/main`.
- A stable resume branch has also been created from that state: `codex/resume-math30-msforms-20260506`.
- If the older `codex/math30-msforms-transfer` feature branch is gone after merge, that is expected. Use `main` or the resume branch instead.
- This STAX handoff captures context and evidence only; executable converter code lives in `brightspacequizexporter`.

## Input PDF

Exact source file used on this machine:

- `/Users/deanguedo/Downloads/Print Quiz - 25-26 _ S2 _ Mathematics 30-2 _ Per 1(A) _ Sec SPO2.pdf`

If the path differs on another computer, update the command input path only.

## Current Command

Run from:

- `/Users/deanguedo/Documents/GitHub/brightspacequizexporter`

Example command with governed local OCR enabled:

```bash
OUT_DIR=$(mktemp -d /tmp/brightspace-msforms-example.XXXXXX)
MSFORMS_MATH_REGION_OCR=1 npm run brightspaceexport -- convert \
  "/Users/deanguedo/Downloads/Print Quiz - 25-26 _ S2 _ Mathematics 30-2 _ Per 1(A) _ Sec SPO2.pdf" \
  --target msforms \
  --math hybrid \
  --diagram-mode flag \
  --output-dir "$OUT_DIR" \
  --render-dpi 300 \
  --equation-recovery glyphs-first \
  --vision-fallback equations-only
echo "$OUT_DIR"
```

Latest output from this machine:

- `/tmp/brightspace-msforms-example.lHnd2Y`

Generated files:

- `quiz.msforms.quickimport.docx`
- `quiz.msforms.native-math.docx`
- `quiz.question_bank.json`
- `quiz.extraction_warnings.json`
- `quiz.forms_lint.txt`
- `quiz.math_region_artifacts.json`
- `math-region-crops/q9-math-region.png`
- `math-region-crops/q10-math-region.png`
- `math-region-crops/q14-math-region.png`

## Current Converter Behavior

The current pipeline produces:

- 27 questions total
- 16 multiple-choice
- 8 numerical-response
- 3 written-response
- 7 safe glyph-math recoveries
- 3 governed OCR attempts rejected

Safe glyph recoveries include:

- Q8: `₁₀Cᵣ = 45`
- Q15: `ₙP₄ = 120`
- Q23: `₈Pᵣ = 1680`
- Additional recovered math appears in choices for combinatorics items.

## Current Warning Codes

Latest example warning summary:

```json
{
  "region_question_segmentation_used": 1,
  "glyph_math_recovered": 7,
  "math_region_recognition_rejected": 3,
  "missing_math_after_solve_for": 1,
  "mangled_set_membership": 1,
  "missing_math_after_evaluate": 2,
  "diagram_dependent_question": 2
}
```

## Current Blocker

Q9, Q10, and Q14 still need better equation recovery from the rendered crop images.

Governed OCR decisions from the latest example:

```txt
Q9:
OCR text: Solve for n, where n = I. zl d-oy ~ P O9 O 8 O 11 O 10
Decision: rejected
Reason: confidence 0.71 below 0.90

Q10:
OCR text: Evaluate. 4 :) O1 O 16 O 4 Oo
Decision: rejected
Reason: confidence 0.77 below 0.90

Q14:
OCR text: Evaluate. 101 ETRE O 16 O 13 O 23 O 20
Decision: rejected
Reason: no equation-shaped math candidate
```

This is the desired safety behavior. Weak OCR did not become semantic math.

## Implemented Brightspace Files

The committed Brightspace repo includes these relevant areas:

- `scripts/brightspaceexport.ts`
- `src/export/msforms/`
- `src/ingest/msforms/`
- `src/test/unit/export/msFormsDocx.test.ts`
- `src/test/unit/ingest/msFormsBrightspaceRegions.test.ts`
- `src/test/unit/ingest/msFormsLint.test.ts`
- `src/test/unit/ingest/msFormsMath.test.ts`
- `src/test/unit/ingest/msFormsMathRegionRecovery.test.ts`
- `src/test/unit/scripts/brightspaceExportScript.test.ts`

The earlier unrelated autopilot work was intentionally kept out of the converter commit. Do not assume autopilot files are part of the Math 30 transfer branch.

## Verification Already Run

These passed after the governed recovery work:

```txt
npm run build
npm test
npm run ingest:ci
```

Latest full test evidence:

- `npm test`: 541 passed, 1 skipped
- `npm run ingest:ci`: build, intake validation of 35 manifests, focused ingest suite, and 22 manual benchmark evaluations passed

Known unrelated lint blockers:

```txt
scripts/send-print-quiz-pdf-to-google-forms-with-vision.ts
  456:27  '_pages' is defined but never used

src/ingest/pdf/visionQuizExtraction.ts
  122:29  unnecessary escape character: \!
  822:20  unnecessary escape character: \-
```

STAX sidecar caveat in Brightspace:

- `npm run stax:preflight` fails strict mode because heartbeat/current-turn capture is stale.
- STAX status verdict itself is `Pass`.

## Next Action

Plug in a stronger equations-only vision recognizer for Q9/Q10/Q14.

The current code supports an external recognizer hook:

```bash
MSFORMS_MATH_REGION_VISION_CMD="<command that accepts crop path and prints JSON>" npm run brightspaceexport -- convert ...
```

Expected recognizer JSON output:

```json
{
  "equation": "n! / [2(n - 2)!] = 45",
  "confidence": 0.94,
  "engine": "equations-only-vision"
}
```

Acceptance rule:

- attach math only if confidence is at least `0.90`
- text must be equation-shaped
- keep warning/crop artifacts when confidence is weak

## Do Not Do

- Do not rewrite reviewed expected fixtures from parser output.
- Do not auto-promote STAX learning candidates.
- Do not lower the 0.90 math-region confidence gate just to make this PDF pass.
- Do not claim Microsoft Forms import success until the generated DOCX is actually imported into Microsoft Forms.
- Do not hide remaining warnings in `quiz.forms_lint.txt`.

## Ready Prompt For Next Computer

```txt
docs/ACTIVE_HANDOFF.md

Read /Users/deanguedo/Documents/GitHub/STAX/docs/ACTIVE_HANDOFF.md and /Users/deanguedo/Documents/GitHub/STAX/docs/handoffs/MATH30_BRIGHTSPACE_MFORMS_ACTIVE_HANDOFF.md.

Then open /Users/deanguedo/Documents/GitHub/brightspacequizexporter.

Fetch and switch codex/resume-math30-msforms-20260506, or pull current origin/main. Confirm scripts/brightspaceexport.ts and src/ingest/msforms/ are present.

Run the Math 30 example command from the handoff. Inspect:
- quiz.forms_lint.txt
- quiz.question_bank.json
- quiz.math_region_artifacts.json
- math-region-crops/q9-math-region.png
- math-region-crops/q10-math-region.png
- math-region-crops/q14-math-region.png

Continue by plugging in a stronger equations-only vision recognizer via MSFORMS_MATH_REGION_VISION_CMD. Accept recovered math only when confidence is at least 0.90 and the output is equation-shaped. Keep unresolved warnings when weak.

Run:
- npm run build
- npm test
- npm run ingest:ci

Also run npm run lint and report the known unrelated lint blockers if they remain.
```
