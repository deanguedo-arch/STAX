# RAX Doctor Command Report

## Purpose

`rax doctor` is a read-only preflight for STAX provider, tool, memory, eval, run, command-evidence, and repo-evidence state.

It exists to make mock-provider and missing-proof states visible before provider-backed planning or repair work.

## CLI

```bash
npm run rax -- doctor
npm run rax -- doctor --print json
npm run rax -- doctor --workspace brightspacequizexporter
```

## Reports

```txt
generator provider/model
critic provider/model
evaluator provider/model
classifier provider/model
OpenAI key presence without printing the key
Ollama configuration presence
fileRead/fileWrite/shell/web/git settings
memory auto-save and approved-memory settings
latest eval result
latest run folder
command evidence counts by source
repo evidence availability
git status
warnings
```

## Safety

```txt
does not print OPENAI_API_KEY
does not execute shell tools
does not mutate files
does not collect new command evidence
does not promote memory/evals/training/policies/schemas/modes
```

## Tests

Coverage includes:

```txt
- mock provider warnings
- OpenAI configured without key warning
- secret values do not appear in formatted or JSON output
- shell/fileWrite disabled settings are shown
- command evidence counts are split by source
- latest eval and latest run are reported when present
- CLI doctor --print json works
```

## Validation Results

```txt
npm run typecheck
  passed
npm test -- --run tests/doctor.test.ts
  passed, 1 file / 6 tests
npm test
  passed, 75 files / 406 tests
npm run rax -- eval
  passed, 16/16
npm run rax -- eval --regression
  passed, 47/47
npm run rax -- eval --redteam
  passed, 9/9
npm run rax -- doctor
  passed smoke; showed mock provider warnings, disabled shell/fileWrite, latest eval/run, command evidence counts, and repo evidence availability
npm run rax -- run "Extract this as STAX fitness signals: Dean trained jiu jitsu Saturday for 90 minutes."
  passed smoke
```
