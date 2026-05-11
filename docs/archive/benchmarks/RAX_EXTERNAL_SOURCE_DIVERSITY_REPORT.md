# RAX External Source Diversity Report

`ExternalSourceDiversityGate` prevents one thread/source from being counted as
broad external comparison.

It canonicalizes source type plus source id, counts same-source new prompts as
new context only, and blocks missing source metadata for superiority.

Different external source identities can count toward source diversity. Same
thread under a different label does not.
