# RAX Phase 11 Provider Comparison Report

Date: 2026-04-30

## Purpose

Rerun the 10-task real workflow campaign with a non-mock generator provider,
compare mock-vs-provider output quality, and keep promotion boundaries strict.

## What Was Added

```txt
src/campaign/ProviderCampaignComparison.ts
scripts/runPhase11ProviderComparison.ts
tests/providerCampaignComparison.test.ts
package script: npm run campaign:phase11
```

## Command

```bash
npm run campaign:phase11
```

## Latest Run Result

```txt
comparisonStatus: provider_run_blocked
providerRequested: openai
reason: OPENAI_API_KEY is required when the generator provider is openai
```

Artifacts:

```txt
runs/real_use_campaign/2026-04-30/phase11_provider_comparison_2026-04-30T03-55-53-529Z.json
runs/real_use_campaign/2026-04-30/phase11_provider_comparison_2026-04-30T03-55-53-529Z.md
```

## Why This Is Still Correct

- The runner executed the full comparison flow.
- It refused to claim provider-backed quality without a working non-mock provider.
- Real-use status remains candidate-only.

## Next Action

Run Phase 11 again with a configured non-mock generator provider:

```bash
# openai path
OPENAI_API_KEY=... RAX_GENERATOR_PROVIDER=openai npm run campaign:phase11

# or ollama path
RAX_GENERATOR_PROVIDER=ollama npm run campaign:phase11 -- --provider=ollama
```

Then promote only repeated provider-backed wins into stronger regression/redteam
coverage.
