# STAX Core Release Profiles

## Purpose

`staxcore release-gate` supports two profiles so we can keep iteration fast while keeping promotion standards strict.

## Profiles

### `standard` (default)

Command:

```bash
npm run validate:staxcore
```

Checks:

```txt
typecheck
tests
doctrine audit
boundary audit
security audit
replay pass + replay diagnostics
```

Use this for:

```txt
local development loops
fast doctrine/boundary/security checks
non-promotion iteration evidence
```

### `strict`

Command:

```bash
npm run validate:staxcore:strict
```

Checks:

```txt
all standard checks
eval
eval --regression
eval --redteam
```

Use this for:

```txt
promotion readiness
merge/release decisions
final human review packets
```

## Guardrails

```txt
Do not promote from standard-only evidence.
Promotion decisions require strict profile evidence.
Release packet artifacts must include the profile and all failed checks, if any.
If strict fails, promotion is blocked even when standard passes.
```

## Evidence Outputs

Both profiles produce:

```txt
runs/staxcore_release/<date>/<artifact>.json
runs/staxcore_release/<date>/<artifact>.md
```

The markdown packet and JSON artifact must be treated as audit evidence; they are not automatic approval.
