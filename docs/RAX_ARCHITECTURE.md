# RAX Architecture

STAX/RAX is a local assistant behavior runtime. It normalizes requests, detects intent and mode, scores risk, enforces boundaries, compiles selected policies, retrieves approved context and examples, routes to a provider, runs approved agents, validates output, logs traces, and supports replay/correction/training export.

```txt
User Input
-> Request Normalization
-> Intent Classification
-> Mode Detection
-> Risk Classification
-> Boundary Decision
-> Policy Selection
-> Policy Compilation
-> Context Retrieval
-> Example Retrieval
-> Provider Selection
-> Primary Generation
-> Critic Review
-> Repair Pass if Needed
-> Formatter Pass
-> Schema Validation
-> Run Logging
-> Final Output
```
