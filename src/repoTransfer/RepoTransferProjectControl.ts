type ProjectControlPacket = {
  task: string;
  repoEvidence: string;
  commandEvidence: string;
  codexReport: string;
};

type TransferArchetype = {
  label: string;
  indicators: string[];
  proofGates: string[];
  riskyActions: string[];
  blockers: string[];
};

const ARCHETYPES: Record<string, TransferArchetype> = {
  typescript_e2e_browser: {
    label: "TypeScript / browser E2E repo",
    indicators: ["package.json", "Playwright/browser test tooling", "workspace scripts"],
    proofGates: ["inspect package manager and scripts", "bounded build/typecheck", "targeted test or E2E subset"],
    riskyActions: ["publish", "release", "browser install/system dependency changes"],
    blockers: ["browser dependencies", "large E2E suite cost", "workspace targeting"]
  },
  js_build_tooling: {
    label: "JavaScript build-tooling repo",
    indicators: ["package.json", "workspace packages", "build/test scripts"],
    proofGates: ["package script inventory", "bounded build", "targeted unit/regression test"],
    riskyActions: ["publish", "snapshot/golden update", "lockfile churn"],
    blockers: ["monorepo package scope", "fixture/golden laundering", "expensive full suite"]
  },
  python_test_framework: {
    label: "Python test-framework repo",
    indicators: ["pyproject.toml", "tox/nox/pytest config", "tests/"],
    proofGates: ["test command discovery", "targeted pytest/tox run", "fixture freshness check"],
    riskyActions: ["global environment changes", "fixture rewrite", "release"],
    blockers: ["optional dependencies", "slow full suite", "local Python version mismatch"]
  },
  python_web_framework: {
    label: "Python web-framework repo",
    indicators: ["pyproject/setup config", "test settings", "framework integration tests"],
    proofGates: ["targeted unit test", "integration smoke when needed", "docs/runtime boundary check"],
    riskyActions: ["migration/apply actions", "release", "external service assumptions"],
    blockers: ["database/service dependencies", "settings matrix", "slow integration suite"]
  },
  rust_lint_workspace: {
    label: "Rust lint/workspace repo",
    indicators: ["Cargo.toml", "workspace crates", "clippy/lint tests"],
    proofGates: ["cargo check", "targeted cargo test", "lint/doc-test distinction"],
    riskyActions: ["workspace-wide rewrite", "fixture/golden updates", "publish"],
    blockers: ["feature flags", "toolchain channel", "large workspace"]
  },
  rust_async_workspace: {
    label: "Rust async workspace repo",
    indicators: ["Cargo.toml workspace", "feature-gated tests", "async runtime tests"],
    proofGates: ["crate-scoped cargo test", "feature-specific test", "cargo check"],
    riskyActions: ["workspace-wide full test first", "publish", "generated artifact edits"],
    blockers: ["feature flags", "runtime/timing flake risk", "workspace targeting"]
  },
  go_monorepo_integration: {
    label: "Go monorepo/integration repo",
    indicators: ["go.mod", "many packages", "integration/e2e scripts"],
    proofGates: ["package-scoped go test", "generated-code check", "integration blocker check"],
    riskyActions: ["cluster/deploy commands", "generated-code mutation", "global go test ./... first"],
    blockers: ["huge suite", "external services", "generated code"]
  },
  go_infra_tooling: {
    label: "Go infrastructure/tooling repo",
    indicators: ["go.mod", "CLI packages", "acceptance/integration tests"],
    proofGates: ["package-scoped go test", "CLI smoke", "acceptance-test boundary"],
    riskyActions: ["terraform apply/deploy", "credential use", "acceptance tests without approval"],
    blockers: ["cloud credentials", "service dependencies", "slow acceptance suites"]
  },
  ruby_framework: {
    label: "Ruby framework repo",
    indicators: ["Gemfile", "gemspec", "RSpec/Minitest"],
    proofGates: ["bundle/test command discovery", "targeted test file", "system-test boundary"],
    riskyActions: ["system test without deps", "release", "migration/apply"],
    blockers: ["bundle setup", "database/browser deps", "slow system tests"]
  },
  php_framework: {
    label: "PHP framework repo",
    indicators: ["composer.json", "phpunit config", "framework packages"],
    proofGates: ["composer script discovery", "targeted PHPUnit run", "integration/service boundary"],
    riskyActions: ["release", "external service mutation", "broad fixture changes"],
    blockers: ["PHP/composer version", "optional extensions", "integration services"]
  },
  ui_visual_system: {
    label: "UI / visual system repo",
    indicators: ["component packages", "storybook/docs", "visual regression tooling"],
    proofGates: ["build/storybook command discovery", "rendered screenshot/checklist", "accessibility evidence when claimed"],
    riskyActions: ["publish", "snapshot update without review", "CSS-only visual approval"],
    blockers: ["browser deps", "visual baseline drift", "responsive/dark-mode states"]
  },
  data_pipeline: {
    label: "Data pipeline repo",
    indicators: ["pipeline configs", "test fixtures", "data validation docs"],
    proofGates: ["dry-run/validation command", "row-count/diff artifact", "fixture/golden review"],
    riskyActions: ["publish/sync/apply", "canonical data mutation", "credentialed external runs"],
    blockers: ["sample data availability", "service credentials", "golden/fixture laundering"]
  }
};

const REPOS = [
  "microsoft/playwright",
  "vitejs/vite",
  "pytest-dev/pytest",
  "django/django",
  "rust-lang/rust-clippy",
  "tokio-rs/tokio",
  "kubernetes/kubernetes",
  "hashicorp/terraform",
  "rails/rails",
  "laravel/framework",
  "storybookjs/storybook",
  "dbt-labs/dbt-core"
] as const;

export function renderRepoTransferProjectControl(packet: ProjectControlPacket): string | undefined {
  const taskText = packet.task;
  const combined = [packet.task, packet.repoEvidence, packet.commandEvidence, packet.codexReport].join("\n");
  const repo = findRepo(combined);
  const archetypeId = findArchetype(combined);
  const transferMarked = /\brepo transfer trial\b|\bpublic repo transfer\b/i.test(combined);
  if (!repo && !archetypeId && !transferMarked) return undefined;

  const archetype = ARCHETYPES[archetypeId ?? ""] ?? inferArchetype(repo);
  const taskKind = transferTaskKind(taskText);
  const codexReport = packet.codexReport.trim();
  const trapText = [packet.task, packet.commandEvidence, packet.codexReport].join("\n");
  const hasCommandEvidence = /\b(exit code\s*:?\s*0|stdout|stderr|passed|failed|command output|\$ )\b/i.test(packet.commandEvidence);
  const scriptExistsTrap = taskKind === "script_exists" || /\b(script-exists|script exists|script existence|package\.json\s+has|package\.json\s+contains)\b/i.test(trapText);
  const fakeCompleteTrap = taskKind === "fake_complete" || /\btests passed|fixed|complete|done|ready\b/i.test(codexReport);

  const verified = [
    repo ? `The target public repo named in the case is ${repo}.` : "The case is a public-repo transfer trial.",
    archetype ? `The supplied archetype is ${archetype.label}.` : undefined,
    "The supplied evidence does not include local checkout, command output, exit code, or inspected repo files."
  ].filter(Boolean) as string[];

  const weak = [
    codexReport && !/^none supplied\.?$/i.test(codexReport) ? `Codex reported: ${codexReport.replace(/\s+/g, " ")}` : undefined,
    archetype ? `Likely indicators are candidates only: ${archetype.indicators.join(", ")}.` : undefined,
    archetype ? `Likely proof gates are candidates only until inspected: ${archetype.proofGates.join(", ")}.` : undefined
  ].filter(Boolean) as string[];

  const unverified = [
    hasCommandEvidence ? undefined : "No command has been proven to run for this public repo case.",
    "Exact package manager, scripts, workspace/package boundary, branch, and current files are unverified.",
    scriptExistsTrap ? "A package/script entry, if present, would prove only availability, not successful execution." : undefined,
    fakeCompleteTrap ? "The completion/tests-passed claim is unverified because no local command evidence was supplied." : undefined,
    taskKind === "visual" ? "Rendered UI state is unverified without screenshot or visual checklist evidence." : undefined
  ].filter(Boolean) as string[];

  const risks = [
    "Cross-repo evidence risk: STAX workspace evidence cannot prove this public repo.",
    "Tooling-assumption risk: suggesting a command before inspecting repo files can create fake proof.",
    scriptExistsTrap ? "Script-existence risk: package/config discovery can be mistaken for command success." : undefined,
    fakeCompleteTrap ? "Fake-complete risk: Codex can claim tests passed without output, cwd, or exit code." : undefined,
    archetype?.riskyActions.length ? `Do not run or recommend live actions yet: ${archetype.riskyActions.join(", ")}.` : undefined
  ].filter(Boolean) as string[];

  const nextAction = nextTransferAction({ repo, archetype, taskKind, fakeCompleteTrap, scriptExistsTrap });
  const prompt = transferCodexPrompt({ repo, archetype, taskKind });

  return [
    "## Verdict",
    `- ${transferVerdict({ repo, archetype, taskKind, fakeCompleteTrap, scriptExistsTrap })}`,
    "",
    "## Verified",
    ...bulletize(verified),
    "",
    "## Weak / Provisional",
    ...bulletize(weak, "Likely tooling and proof gates are provisional until repo files are inspected."),
    "",
    "## Unverified",
    ...bulletize(unverified),
    "",
    "## Risk",
    ...bulletize(risks),
    "",
    "## One Next Action",
    `- ${nextAction}`,
    "",
    "## Codex Prompt if needed",
    prompt
  ].join("\n");
}

function findRepo(text: string): string | undefined {
  return REPOS.find((repo) => text.toLowerCase().includes(repo.toLowerCase()));
}

function findArchetype(text: string): string | undefined {
  return Object.keys(ARCHETYPES).find((name) => text.includes(name));
}

function inferArchetype(repo: string | undefined): TransferArchetype | undefined {
  if (!repo) return undefined;
  if (repo === "microsoft/playwright") return ARCHETYPES.typescript_e2e_browser;
  if (repo === "vitejs/vite") return ARCHETYPES.js_build_tooling;
  if (repo === "pytest-dev/pytest") return ARCHETYPES.python_test_framework;
  if (repo === "django/django") return ARCHETYPES.python_web_framework;
  if (repo === "rust-lang/rust-clippy") return ARCHETYPES.rust_lint_workspace;
  if (repo === "tokio-rs/tokio") return ARCHETYPES.rust_async_workspace;
  if (repo === "kubernetes/kubernetes") return ARCHETYPES.go_monorepo_integration;
  if (repo === "hashicorp/terraform") return ARCHETYPES.go_infra_tooling;
  if (repo === "rails/rails") return ARCHETYPES.ruby_framework;
  if (repo === "laravel/framework") return ARCHETYPES.php_framework;
  if (repo === "storybookjs/storybook") return ARCHETYPES.ui_visual_system;
  if (repo === "dbt-labs/dbt-core") return ARCHETYPES.data_pipeline;
  return undefined;
}

function transferTaskKind(text: string): "onboarding" | "fake_complete" | "script_exists" | "bounded_prompt" | "proof_gap" | "visual" | "generic" {
  if (/\b(onboarding card|language\/tooling indicators)\b/i.test(text)) return "onboarding";
  if (/\bfake-complete|tests passed|fixed it and tests passed\b/i.test(text)) return "fake_complete";
  if (/\bscript-exists|script exists|package\.json.*script\b/i.test(text)) return "script_exists";
  if (/\bbounded Codex prompt|one bounded prompt|next bounded\b/i.test(text)) return "bounded_prompt";
  if (/\bproof-gap|proof gap|what proof is missing\b/i.test(text)) return "proof_gap";
  if (/\bvisual|screenshot|rendered\b/i.test(text)) return "visual";
  return "generic";
}

function transferVerdict(input: {
  repo?: string;
  archetype?: TransferArchetype;
  taskKind: ReturnType<typeof transferTaskKind>;
  fakeCompleteTrap: boolean;
  scriptExistsTrap: boolean;
}): string {
  if (input.fakeCompleteTrap) return "Reject the completion claim; public-repo tests are unverified without repo-local command output.";
  if (input.scriptExistsTrap) return "Script existence is not proof; it only identifies a candidate command to inspect or run later.";
  if (input.taskKind === "onboarding") return "Onboarding can be drafted as provisional repo intelligence, not verified proof.";
  if (input.taskKind === "bounded_prompt") return "A bounded Codex prompt is appropriate if it only inspects repo proof surfaces and stops before mutation.";
  if (input.taskKind === "proof_gap") return "The proof gap is the absence of inspected repo files, exact command output, cwd, branch, and exit code.";
  return "Needs repo-local evidence before any completion, test-pass, visual, deploy, or release claim.";
}

function nextTransferAction(input: {
  repo?: string;
  archetype?: TransferArchetype;
  taskKind: ReturnType<typeof transferTaskKind>;
  fakeCompleteTrap: boolean;
  scriptExistsTrap: boolean;
}): string {
  const repo = input.repo ?? "the target public repo";
  if (input.fakeCompleteTrap) {
    return `Ask Codex to produce ${repo} evidence with cwd, branch/ref, exact command, exit code, and relevant output; otherwise mark the report unverified and stop.`;
  }
  if (input.scriptExistsTrap) {
    return `Inspect ${repo} package/tooling files, identify the exact candidate proof command, and paste back the script source without claiming it passed.`;
  }
  if (input.taskKind === "bounded_prompt") {
    return `Send one proof-discovery prompt for ${repo}: inspect tooling/docs, list candidate proof gates, name blockers, and stop before running destructive or huge commands.`;
  }
  if (input.taskKind === "proof_gap") {
    return `Collect the smallest proof packet for ${repo}: repo identity, branch/ref, package/tooling files inspected, candidate command, and what remains unverified.`;
  }
  return `Create a provisional onboarding card for ${repo}, then paste back inspected repo files before treating any command or proof gate as verified.`;
}

function transferCodexPrompt(input: {
  repo?: string;
  archetype?: TransferArchetype;
  taskKind: ReturnType<typeof transferTaskKind>;
}): string {
  const repo = input.repo ?? "the target public repo";
  const gates = input.archetype?.proofGates.join("; ") ?? "candidate build/test/lint proof gates";
  const blockers = input.archetype?.blockers.join("; ") ?? "environment and dependency blockers";
  return [
    "```txt",
    `Work only as a read-only auditor for ${repo}.`,
    "Do not run deploy, publish, release, sync, apply, credentialed, destructive, force, cache-clearing, or broad full-suite commands.",
    "First inspect repo identity, branch/ref if available, README/contribution docs, package/tooling config, and scripts.",
    `Candidate proof gates to verify or downgrade: ${gates}.`,
    `Likely blockers to surface: ${blockers}.`,
    "Return verified, weak/provisional, unverified, risk, and exactly one next bounded proof action.",
    "If a command is only discovered in config, say it exists but has not passed.",
    "Paste back exact file paths inspected and the first safe command candidate; stop before mutation.",
    "```"
  ].join("\n");
}

function bulletize(items: string[], fallback = "None identified from supplied input."): string[] {
  return items.length ? items.map((item) => `- ${item}`) : [`- ${fallback}`];
}
