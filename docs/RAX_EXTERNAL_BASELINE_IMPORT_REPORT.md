# RAX External Baseline Import Report

`ExternalBaselineImport` validates manually captured external baselines without
rewriting fixtures or treating external answers as authority.

Required metadata:

- case id
- external answer
- source
- capture timestamp
- prompt
- capture context
- human drift confirmation

The validator rejects missing metadata, generic answers, drifted answers,
answers that ignore the task, STAX-architecture drift, and copied STAX answers.

CLI:

```bash
npm run rax -- compare import-baseline --file external_baseline.json
```

This is an import validator and report only. It does not scrape, promote, or
mutate benchmark fixtures.
