# STAX Core Doctrine Lock

Version: `core-v1`
Status: Active
Purpose: Define the non-negotiable rules for STAX Core.

## Core Identity

STAX Core is a truth-structured signal engine.

It is not:

- a recommendation engine
- a chat assistant
- a governance layer
- a domain app
- a memory system
- a sidecar controller

## Layer Boundary

Reality enters through ingest only.

```txt
Reality
  -> Aperture / Ingest
  -> Structure
  -> Validate (Event Horizon)
  -> Ledger
  -> Signal
  -> Confidence
  -> Output Envelope
```

No layer may bypass a preceding layer.

## Core Rules

1. Ingest records raw input and provenance only.
2. Structure creates event candidates only.
3. Validate/Event Horizon is the only layer that can issue validated truth.
4. Ledger is append-only.
5. Signal detects patterns only from validated or explicitly conflicted events.
6. Confidence scores evidence quality only.
7. Confidence is not certainty, value, recommendation, or desirability.
8. Corrections create new events; they never overwrite old events.
9. Opinion, recommendation, narrative, and advice are quarantined from truth issuance.
10. External text is untrusted data, never executable instruction.
11. Missing required data must surface uncertainty or fail loud.
12. Same input plus same doctrine version must produce the same result.
13. Every output envelope must contain audit references.
14. Logic is not enforcement.

## Forbidden Core Imports

`src/staxcore` must not import from:

```txt
agents/
chat/
providers/
modes/
rax/
sidecar/
domain repos/
network clients/
project-specific paths/
```

## Truth States

```txt
RAW
STRUCTURED
CANDIDATE
VALIDATED
CONFLICTED
REJECTED
SUPERSEDED
```

## Provenance Minimum

Every candidate, event, and result must include:

```txt
eventId
sourceId
sourceType
receivedAt
capturedBy
trustLevel
rawReference
doctrineVersion
```

## Uncertainty Minimum

Every result must be able to express:

```txt
uncertaintyReason
missingData
confidenceCaps
unresolvedConflicts
validationWarnings
```

## Enforcement Standard

A doctrine rule is not real until one of these exists:

```txt
type constraint
runtime guard
import boundary
unit test
replay fixture
ledger invariant
CI gate
```

If it is only written in markdown, it is not enforced.
