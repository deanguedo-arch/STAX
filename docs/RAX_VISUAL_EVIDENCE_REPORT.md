# RAX Visual Evidence Report

`VisualEvidenceProtocol` keeps visual/UI claims inside their proof boundary.

Rules:

- source files alone mean missing visual proof
- screenshot without checklist is partial
- screenshot plus checklist verifies listed checks only
- visual evidence cannot prove runtime command success
- command output cannot prove visual correctness

Useful request shape:

```txt
Paste screenshot or visual finding for these checks:
- text fit
- border symmetry
- checkmark containment
```
