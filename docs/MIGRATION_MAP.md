# STAX Migration Map

Date: 2026-04-29

This map prevents architecture drift while STAX Core is rebuilt.

## Classification Buckets

All existing and incoming material is classified as:

```txt
core
meta
reference
deprecated
```

## Mapping Rules

### core

Belongs in the canonical truth pipeline:

```txt
ingest
structure
validate
signal
confidence
frame
context
exchange
shared ledger/audit/provenance types
```

### meta

Governance, audits, benchmark reports, red-team notes, and operator workflows.

Examples:

```txt
RAX_* reports
manual benchmark scorecards
operator mode docs
project-control playbooks
```

### reference

Useful design input but not directly executable in core.

Examples:

```txt
owner audit recommendations
external prompts
draft architecture notes
```

### deprecated

Any path that conflicts with doctrine lock, bypasses validation boundaries, or permits silent truth mutation.

## ZIP + Prompt Policy

The user-provided zip and prompt packs are treated as:

```txt
Core rebuild inputs (reference -> core execution plan)
```

They do not automatically become production truth logic without boundary/tests.

Current input set:

```txt
/Users/deanguedo/Downloads/STAX-main-core-rebuild.zip
/Users/deanguedo/Downloads/STAX-dean-clean-core-hardening.zip
```

Interpretation:

```txt
STAX-main-core-rebuild.zip = migration/reference source
STAX-dean-clean-core-hardening.zip = doctrine-aligned core scaffold
```

## Boundary Between Core and Operator

Core:

```txt
truth issuance
provenance
uncertainty
audit trace
append-only ledger
```

Operator/RAX layer:

```txt
project_control
codex_audit
prompt_factory
control-audit CLI
benchmark workflows
```

Operator may consume core outputs. Operator may not bypass core validation.
