# Repo Transfer RC2a Hygiene Report

Date: 2026-05-02

## Verdict

RC2 remains quarantined as a provisional proof pack.

RC2a is now the clean repo-transfer proof pack. It contains a fresh all-60 raw ChatGPT recapture, strengthened capture hygiene, canonical scoring, and command-proof evidence.

## What Changed

- Capture validation now flags embedded benchmark prompts:
  - `You are raw ChatGPT`
  - `Case ID:`
  - `Critical miss rules:`
  - `Use exactly these headings:`
- Capture validation no longer treats ordinary answer labels such as `Repo:`, `Archetype:`, or `Supplied evidence:` as prompt contamination by themselves.
- Capture validation still flags UI/copy contamination:
  - `Thinking`
  - `Thought for`
  - `Heavy`
  - `GitHub`
  - `Retry`
  - `Unusual activity`
  - copy/share/action labels
- Capture validation flags more than one required project-control section, including multiple `## Verdict` headings.
- Capture validation flags exact other-repo full names in a capture when the run contains the expected repo identity.
- Repo-transfer scoring refuses to score invalid captures, including contaminated or missing outputs.
- Repo-transfer canonical score writing refuses to write invalid captures, including contaminated or missing outputs.
- Repo-transfer score entries derive critical-miss fields from an explicit local adjudication helper instead of hard-coding both sides to `false`.

## Historical RC2 Status

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

The historical RC2 run is not allowed to support a clean `60-0` claim.

## Fresh RC2a Status

Run:

```txt
fixtures/real_use/runs/repo-transfer-12x5-rc2a-2026-05-02/
```

Capture hygiene:

```txt
status: clean
invalid capture outputs: 0
contaminated capture outputs: 0
missing capture outputs: 0
```

Canonical score result:

```txt
total cases: 60
STAX wins: 60
ChatGPT wins: 0
ties: 0
STAX critical misses: 0
ChatGPT critical misses: 5
confidence: benchmark_slice_proven
superiorityStatus: slice_only
```

Command proof:

```txt
status: passed
profile: clean
```

The clean command-proof profile recorded:

```bash
npm run repo-transfer:capture-hygiene -- --run repo-transfer-12x5-rc2a-2026-05-02 --expect-clean
npm run campaign:integrity -- --run repo-transfer-12x5-rc2a-2026-05-02
npm run repo-transfer:score-run -- --run repo-transfer-12x5-rc2a-2026-05-02 --write
npm run repo-transfer:integrity
npm run typecheck
npm test
npm run rax -- eval
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
```

## Allowed Claim

STAX cleanly won the fresh RC2a 60-case public-repo project-control transfer slice against raw ChatGPT in the Codex in-app browser, with zero STAX critical misses and clean capture hygiene.

This is a scoped project-control transfer-slice claim.

## Not Allowed Claim

This does not prove general ChatGPT superiority, production readiness, autonomous approval, or that public-repo commands/tests themselves passed.

## Next Action

Use RC2a as the clean repo-transfer proof pack and keep future public-repo transfer claims gated by capture hygiene, comparison integrity, canonical scoring, and command proof.
