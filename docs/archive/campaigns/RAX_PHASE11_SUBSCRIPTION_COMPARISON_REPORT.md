# RAX Phase 11 Subscription Comparison Report

Date: 2026-04-30

## Purpose

Support Phase 11 comparison without API keys by using ChatGPT subscription
outputs as the external baseline.

STAX still runs locally via `project_control`. Comparison scores are entered
through a fixture and compiled into auditable artifacts.

`campaign:phase11:prepare` is safe to rerun: it refreshes STAX-side run metadata
while preserving any existing captured ChatGPT outputs and scoring fields by
`taskId`.

## What Was Added

```txt
src/campaign/SubscriptionCampaignComparison.ts
scripts/preparePhase11BrowserCapture.ts
scripts/phase11NextPrompt.ts
scripts/phase11CaptureClipboard.ts
scripts/runPhase11SubscriptionComparison.ts
tests/subscriptionCampaignComparison.test.ts
package script: npm run campaign:phase11:prepare
package script: npm run campaign:phase11:next
package script: npm run campaign:phase11:capture
package script: npm run campaign:phase11:subscription
fixtures/real_use/phase11_subscription_capture.json (browser-assisted template)
```

## Command

```bash
npm run campaign:phase11:prepare
npm run campaign:phase11:next
npm run campaign:phase11
```

`campaign:phase11` now resolves to the subscription/browser comparison path.
No OpenAI API key is required for this lane.

## Latest Run

```txt
status: scored_no_losses
summary:
- total: 10
- STAX wins: 1
- ChatGPT wins: 0
- ties: 9
- STAX critical misses: 0
- ChatGPT critical misses: 1
scoreFile: fixtures/real_use/phase11_subscription_capture.json
```

Artifacts:

```txt
runs/real_use_campaign/2026-04-30/phase11_subscription_comparison_2026-04-30T14-17-41-208Z.json
runs/real_use_campaign/2026-04-30/phase11_subscription_comparison_2026-04-30T14-17-41-208Z.md
runs/real_use_campaign/<date>/phase11_browser_prompt_pack_<timestamp>.md
```

## Scoring Rule

```txt
winner requires at least a 2-point score margin
critical miss overrides score margin
```

## Next Action

Keep promotion blocked. This round removed losses but did not prove strong
superiority.

Immediate focus:

```txt
1. Convert high-value ties into STAX wins using repo-specific next-action precision.
2. Re-run browser-assisted capture for any prompts where ChatGPT wording changed materially.
3. Add regression coverage for newly fixed plain-task codex-report and visual-proof routing.
4. Keep STAX critical misses at zero while pushing win count above tie-only parity.
```
