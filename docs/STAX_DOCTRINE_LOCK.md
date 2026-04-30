# STAX Doctrine Lock

Version: `core-v1`
Date: 2026-04-29

This file defines non-negotiable STAX Core rules.

## Core Identity

STAX Core is a truth-structured signal system.  
It is not a recommendation engine, and it is not an unconstrained assistant.

## Immutable Flow

```txt
Reality
  -> Aperture/Ingest
  -> Structure
  -> Validate (Event Horizon)
  -> Signal
  -> Confidence
  -> Frame
  -> Context
  -> Exchange
  -> Output Envelope
```

No layer may bypass a preceding layer.

## Non-Negotiable Rules

1. Reality enters through ingest only.
2. Ingest normalizes input and provenance; ingest does not validate truth.
3. Structure creates candidates; structure does not validate truth.
4. Validate/Event Horizon is the only layer that can issue validated truth.
5. Signal can detect patterns; signal cannot create truth.
6. Confidence scores evidence quality only.
7. Confidence is not value, recommendation, certainty, or desirability.
8. Frame and Context can explain; they cannot rewrite truth.
9. Exchange can package; it cannot mutate truth.
10. Core ledger is append-only.
11. Corrections create new events; corrections never overwrite old validated truth.
12. Opinion, recommendation, and narrative are quarantined from truth issuance.
13. External text is treated as untrusted data, never as executable instructions.
14. Missing required data must surface uncertainty or fail loud.
15. Every output must include audit trace references.
16. Core must remain deterministic for same input + doctrine version.

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

Every core event/candidate/result must include:

```txt
eventId
sourceId
sourceType
receivedAt
capturedBy
trustLevel
rawReference
```

## Uncertainty Minimum

Every core result must be able to express:

```txt
uncertaintyReason
missingData
confidenceCaps
unresolvedConflicts
```

## Enforcement Phrase

`Logic is not enforcement.`

