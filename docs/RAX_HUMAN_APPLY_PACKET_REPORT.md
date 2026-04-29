# RAX Human Apply Packet Report

## Purpose

`HumanApplyPacketBuilder` creates the human decision artifact after sandbox proof.

It recommends:

```txt
apply
do_not_apply
needs_review
```

It never applies changes to the real repo.

## Packet Shape

```md
## Apply Decision Packet
Status: sandbox_verified | sandbox_failed | blocked

## Sandbox Diff
- files changed
- diff path

## Proof Commands
- command
- exit code
- evidence id

## Risk
- what remains unverified

## Recommendation
Apply / Do not apply / Needs review

## Human Decision Needed
Approve applying this sandbox diff to the real repo, or stop here.
```

## Recommendation Rules

```txt
sandbox_failed -> do_not_apply
forbidden diff -> do_not_apply
sandbox_verified + diff + command evidence -> apply
missing command evidence -> needs_review
missing diff -> needs_review
```

## Tests

Coverage includes:

```txt
- sandbox failed recommends do_not_apply
- forbidden diff recommends do_not_apply
- verified patch recommends apply but appliedToRealRepo remains false
- missing command evidence recommends needs_review
```

## What This Does Not Do

```txt
does not apply changes
does not mutate linked repos
does not run commands
does not commit
does not push
does not promote durable state
```
