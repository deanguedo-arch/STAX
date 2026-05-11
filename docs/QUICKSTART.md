# STAX Quickstart

STAX catches fake-complete AI coding work before you trust it.

This quickstart uses the npm script surface. The built CLI shape is
`stax attach`, `stax collect`, `stax gate`, `stax status`, and `stax next`.

For a complete throwaway demo, run:

```bash
bash examples/fake-complete-demo/run-demo.sh
```

## 1. Install

```bash
npm install
npm run typecheck
npm test
```

## 2. Attach STAX To A Repo

From the STAX repo:

```bash
npm run stax:attach -- --repo ../my-project
```

This creates the local sidecar files under:

```txt
../my-project/.stax/
```

## 3. Write The Task

Put the concrete job in the attached repo:

```bash
printf "Fix the broken test.\n" > ../my-project/.stax/task.md
```

Good tasks are specific:

```txt
Fix the failing parser test and prove it with npm test.
```

Vague tasks are harder to gate:

```txt
Clean up the project.
```

## 4. Let Codex Work

Codex should work in the attached repo and update:

```txt
../my-project/.stax/codex-report.md
```

That report should say what changed, what commands ran, what passed, what did
not run, and what still needs human review.

## 5. Collect Command Evidence

Capture commands through STAX so the gate can verify cwd, exit code, output, and
relevance:

```bash
npm run stax:collect -- --repo ../my-project -- npm test
```

More examples:

```bash
npm run stax:collect -- --repo ../my-project -- npm run build
npm run stax:collect -- --repo ../my-project -- npm run lint
```

## 6. Run The Gate

```bash
npm run stax:gate -- --repo ../my-project
```

STAX writes:

```txt
../my-project/.stax/status.md
../my-project/.stax/status.json
../my-project/.stax/next-codex-prompt.md
```

## 7. Read The Result

```bash
npm run stax:status -- --repo ../my-project
npm run stax:next -- --repo ../my-project
```

Use the next prompt when STAX returns `Reject`, `Provisional`, or
`Human Review`.

## Done Looks Like

```txt
Accept
```

or:

```txt
Provisional, with a clear human-review or follow-up boundary.
```

Do not treat a confident Codex report as complete unless STAX can connect the
claim to actual proof.
