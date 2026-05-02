# Repo Transfer RC2a Hygiene Report

Date: 2026-05-02

## Verdict

RC2 is quarantined as a provisional proof pack.

The external ChatGPT judge accepted the release packaging shape, but rejected the clean `60-0` claim because the captured ChatGPT baseline contains prompt/UI contamination and wrong-repo bleed. RC2a therefore hardens the validator and blocks scoring until recapture is complete.

## What Changed

- Capture validation now flags embedded benchmark prompts:
  - `You are raw ChatGPT`
  - `Case ID:`
  - `Critical miss rules:`
  - `Use exactly these headings:`
- Capture validation now flags UI/copy contamination:
  - `Thinking`
  - `Thought for`
  - `Heavy`
  - `GitHub`
  - `Retry`
  - `Unusual activity`
  - copy/share/action labels
- Capture validation now flags more than one required project-control section, including multiple `## Verdict` headings.
- Capture validation now flags exact other-repo full names in a capture when the run contains the expected repo identity.
- Repo-transfer scoring now refuses to score invalid captures, including contaminated or missing outputs.
- Repo-transfer canonical score writing now refuses to write invalid captures, including contaminated or missing outputs.
- Repo-transfer score entries now derive critical-miss fields from an explicit local adjudication helper instead of hard-coding both sides to `false`.

## Current Historical Run Status

Run:

```txt
fixtures/real_use/runs/repo-transfer-12x5-2026-05-01/
```

Current status:

```txt
recapture_required
```

Current hygiene result:

```txt
invalid capture outputs: 42
contaminated capture outputs: 42
missing capture outputs: 0
```

The historical RC2 run is no longer allowed to support a clean `60-0` claim until the contaminated ChatGPT baseline rows are recaptured and rescored.

## Fresh Recapture Run Status

Run:

```txt
fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/
```

Current status:

```txt
recapture_required
```

Current hygiene result:

```txt
invalid capture outputs: 60
contaminated capture outputs: 0
missing capture outputs: 60
```

This is expected for the newly prepared run. It has refreshed local STAX outputs, but raw ChatGPT browser captures have not been recorded yet. The missing-output result proves the strengthened gate will not score a blank or partially captured run.

## Allowed Claim

STAX has a scoped RC2 public-repo project-control proof pack and a strengthened RC2a hygiene gate that now catches the capture contamination found by the external judge, blocks missing captures, and prevents canonical score writing until recapture is clean.

## Not Allowed Claim

STAX cleanly beat raw ChatGPT `60-0` on the repo-transfer slice.

That claim is blocked until a clean recapture passes:

```bash
npm run repo-transfer:capture-hygiene -- --run <clean-run>
npm run campaign:integrity -- --run <clean-run>
npm run repo-transfer:score-run -- --run <clean-run> --write
```

## Next Action

Complete the fresh all-60 recapture run using the copy-response capture path instead of DOM-region scraping. Only package a scored RC2a proof pack if all strengthened integrity checks pass.
