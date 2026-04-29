# RAX Project Control Audit Pack

Date: 2026-04-29

## Purpose

Turn project-control audits from an ad hoc chat pattern into a reusable case-driven tool.

The `project_control` mode remains the policy/validator boundary.
The audit pack adds fixture cases and a CLI runner so a case can be executed consistently.

## CLI

Run one case:

```bash
npm run rax -- control-audit --case fixtures/control_audits/wrong_repo_command_evidence.json
```

Run one case with JSON output:

```bash
npm run rax -- control-audit --case fixtures/control_audits/wrong_repo_command_evidence.json --print json
```

Run one case from a multi-case file:

```bash
npm run rax -- control-audit --case fixtures/manual_benchmark/stax_vs_raw_chatgpt_round3_stateful_cases.json --case-id round3_stateful_crossrepo_brightspace_vs_canvas_009
```

## Fixture Pack

```txt
fixtures/control_audits/wrong_repo_command_evidence.json
fixtures/control_audits/dependency_scope_violation.json
fixtures/control_audits/seed_gold_false_repair.json
fixtures/control_audits/visual_css_false_proof.json
fixtures/control_audits/sheets_sync_no_preflight.json
fixtures/control_audits/apps_script_wrong_root.json
fixtures/control_audits/avg_total_no_dry_run.json
```

## Case Runner

`src/control/ControlAuditCaseRunner.ts`:

```txt
- loads a case object, array, or collection-with-cases
- enforces case schema
- requires --case-id when multiple cases exist
- builds the standard project_control audit prompt
- runs runtime in mode=project_control
```

`src/control/ControlAuditSchemas.ts` defines the case/collection schemas.

## Boundaries

This does not add uncontrolled execution.

It does not:

```txt
- auto-promote memory/eval/training/policy/schema/mode changes
- apply real repo mutations
- deploy/publish/sync without proof
- bypass project_control validator boundaries
```

## Validation

Run:

```bash
npm run typecheck
npm test
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
npm run rax -- eval
```

