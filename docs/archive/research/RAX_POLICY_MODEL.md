# RAX Policy Model

Policies are explicit local Markdown files under `policies/`. `PolicySelector` chooses only the policies relevant to the current mode and boundary decision. `PolicyCompiler` combines selected policies, the mode contract, examples, memory, and user input into a compiled policy bundle.
