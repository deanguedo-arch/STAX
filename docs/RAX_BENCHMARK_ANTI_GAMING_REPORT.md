# RAX Benchmark Anti-Gaming Report

`BenchmarkAdversary` generates deterministic answer mutations that try to game
benchmark scoring with:

- irrelevant file names
- irrelevant commands
- proof-honesty slogans
- fake local evidence
- vague commands
- removed repo names

The scorer now applies small anti-gaming penalties for command spam, path spam,
unsupported completion claims, and slogan-only proof theater. Stuffed answers
must score lower than clean useful answers.
