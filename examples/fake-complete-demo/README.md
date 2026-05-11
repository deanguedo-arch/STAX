# Fake-Complete Demo

This demo shows the core STAX product loop:

```txt
AI says it is fixed -> STAX checks proof -> missing proof gets rejected
```

Run it from the STAX repo:

```bash
bash examples/fake-complete-demo/run-demo.sh
```

The script creates a throwaway repo under your system temp directory, attaches
STAX, simulates an AI code fix, writes a confident Codex report claiming tests
passed, and runs the gate before command evidence exists. Set
`STAX_FAKE_COMPLETE_DEMO_DIR` if you want to choose the location.

Expected first result:

```txt
Status: Reject
```

Then it captures real command evidence with:

```bash
stax collect --repo <demo-repo> -- npm test
```

Because this is a standalone shell demo rather than a live Codex session, the
script sets the demo repo's runtime freshness mode to `manual`. After the Codex
report is updated with the collected proof, the second gate should move to:

```txt
Status: Accept
```
