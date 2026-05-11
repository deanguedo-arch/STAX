# RAX Training Data Model

RAX does not fine-tune models in v0.1. It exports training-ready JSONL from goldens and approved corrections.

- SFT exports use system/user/assistant messages.
- Preference exports use chosen/rejected pairs from corrections.
- Metadata records mode, policy set, source, run ID, and error type when available.
