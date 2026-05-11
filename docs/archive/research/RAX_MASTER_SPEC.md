# STAX/RAX Master Spec

## Goal

Build a local assistant behavior system that is more controllable, auditable, replayable, correctable, and domain-reliable than a general chat assistant.

## Local Equivalents

- model capability -> provider routing
- implicit learned behavior -> examples, goldens, evals, corrections, training exports
- hidden policies/filters -> explicit versioned policies, risk classifier, boundary decision, schemas, redteam evals
- probabilistic context adaptation -> mode detection, policy compilation, retrieval, critic/repair

## Non-Goals

- no ChatGPT clone
- no jailbreak tool
- no hidden policy extraction
- no uncontrolled tool execution
- no UI until CLI is stable
- no embeddings in v0.1
- no recursive agents

## Core Runtime Pipeline

```txt
User Input
-> Normalize Input
-> IntentClassifier
-> ModeDetector
-> RiskClassifier
-> BoundaryDecision
-> PolicySelector
-> PolicyCompiler
-> MemoryRetriever
-> ExampleRetriever
-> ProviderRouter
-> Primary Generation
-> CriticGate
-> RepairController if needed
-> Formatter
-> SchemaValidator
-> RunLogger
-> Final Output
```
