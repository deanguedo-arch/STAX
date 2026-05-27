# Security Policy

This repository is a local proof gate and sidecar-control surface. Treat it as control infrastructure, not as a place to store private user data.

## Hard Rules

- Do not commit `.env`, `.env.*`, API keys, OAuth tokens, passwords, private screenshots, private command logs, or personal data.
- Do not pipe remote scripts into a shell.
- Do not run deploy, publish, push, release, infrastructure mutation, credential-read, network-upload, or destructive filesystem commands through STAX evidence collection without explicit human approval.
- Keep raw evidence logs outside target repos when possible. Attached repos should contain pointer files and status artifacts, not raw secrets or full private logs.
- Do not treat Codex-reported output, script existence, docs-only changes, or stale command evidence as strong local proof.

## Local Validation

Run the hardened gate before sharing a release artifact or using STAX as a sidecar baseline:

```bash
npm ci
npm run validate:hardened
```

For broader local proof, also run:

```bash
npm run smoke:stax
npm run rax -- eval
npm run rax -- eval --regression
npm run rax -- eval --redteam
```
