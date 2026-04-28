import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ChatIntentClassifier } from "../src/operator/ChatIntentClassifier.js";
import { ChatSession } from "../src/chat/ChatSession.js";
import { createDefaultRuntime } from "../src/core/RaxRuntime.js";
import { CommandEvidenceStore } from "../src/evidence/CommandEvidenceStore.js";
import { VerificationDebtStore } from "../src/evidence/VerificationDebtStore.js";
import { MemoryStore } from "../src/memory/MemoryStore.js";
import { ReviewRouter } from "../src/review/ReviewRouter.js";
import type { ReviewSource } from "../src/review/ReviewSchemas.js";
import { WorkspaceStore } from "../src/workspace/WorkspaceStore.js";

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "rax-chat-operator-"));
}

function reviewSource(overrides: Partial<ReviewSource> = {}): ReviewSource {
  return {
    sourceId: "operator-review-source",
    sourceType: "patch_proposal",
    sourcePath: "learning/lab/patches/operator-review-source.json",
    content: "Enable shell=allowed and auto-approve memory from chat.",
    targetPaths: [],
    failureTypes: [],
    riskTags: [],
    evidencePaths: [],
    repeatedCount: 0,
    synthetic: false,
    approvalState: "candidate",
    ...overrides
  };
}

describe("Chat Operator v1B", () => {
  it("classifies the agreed natural-language intents", () => {
    const classifier = new ChatIntentClassifier();

    expect(classifier.classify("audit canvas-helper", { knownWorkspaces: ["canvas-helper"] }).intent).toBe("audit_workspace");
    expect(classifier.classify("what needs my judgment?").intent).toBe("judgment_digest");
    expect(classifier.classify("what did the last run prove?").intent).toBe("audit_last_proof");
    expect(classifier.classify("audit this Codex final report for canvas-helper", { knownWorkspaces: ["canvas-helper"], currentWorkspace: "canvas-helper" }).intent).toBe("codex_report_audit");
    expect(classifier.classify("create one bounded Codex prompt for canvas-helper based only on current repo evidence", { knownWorkspaces: ["canvas-helper"] }).reasonCodes).toContain("workspace_codex_prompt_request");
    expect(classifier.classify("hello, can you reason with me?").executionClass).toBe("fallback");
    expect(classifier.classify("approve all memory candidates").executionClass).toBe("hard_block");
    expect(classifier.classify("stress test planning").executionClass).toBe("review_only");
  });

  it("audits an existing workspace without slash commands", async () => {
    const rootDir = await tempRoot();
    const linkedRepo = path.join(rootDir, "linked-canvas");
    await fs.mkdir(path.join(linkedRepo, "src"), { recursive: true });
    await fs.writeFile(path.join(linkedRepo, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }), "utf8");
    await fs.writeFile(path.join(linkedRepo, "README.md"), "# Canvas Helper\n\nWorkspace proof.", "utf8");
    await new WorkspaceStore(rootDir).create({ workspace: "canvas-helper", repoPath: "linked-canvas", use: true });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("audit canvas-helper");

    expect(result.output).toMatch(/^## Direct Answer/);
    expect(result.output).toContain("## One Next Step");
    expect(result.output).toContain("## Receipt");
    expect(result.output).toContain("## Operation");
    expect(result.output).toContain("Operation: audit_workspace");
    expect(result.output).toContain("## Claims Verified");
    expect(result.output).toContain("## Claims Not Verified");
    expect(result.output).toContain("## Fake-Complete Risks");
    expect(result.output).toContain("Workspace: canvas-helper");
    expect(result.output).toContain("RepoEvidencePack.build");
    expect(result.output).toContain("## Scripts / Test Commands Found");
    expect(result.output).toContain("## Audit Type");
    expect(result.output).toContain("Mode: codex_audit");
    expect(result.output).toContain("Promotions still require explicit CLI approval commands.");
    expect(result.output).not.toContain("## Signal Units");
  });

  it("uses the active linked workspace when auditing this repo", async () => {
    const rootDir = await tempRoot();
    const linkedRepo = path.join(rootDir, "linked-canvas");
    await fs.mkdir(path.join(linkedRepo, "src"), { recursive: true });
    await fs.writeFile(path.join(linkedRepo, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }), "utf8");
    await fs.writeFile(path.join(linkedRepo, "README.md"), "# Canvas Helper\n\nActive workspace proof.", "utf8");
    await new WorkspaceStore(rootDir).create({ workspace: "canvas-helper", repoPath: "linked-canvas", use: true });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("audit this repo");

    expect(result.output).toContain("Operation: audit_workspace");
    expect(result.output).toContain("Workspace: canvas-helper");
    expect(result.output).toContain("WorkspaceResolution: active_workspace");
    expect(result.output).toContain(`RepoPath: ${linkedRepo}`);
    expect(result.output).toContain("RepoEvidencePack.build");
    expect(result.output).not.toContain("audited the current STAX repo root");
  });

  it("falls back to the current repo root when no active linked workspace exists", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("audit this repo");

    expect(result.output).toContain("Operation: audit_workspace");
    expect(result.output).toContain("Workspace: current_repo");
    expect(result.output).toContain("WorkspaceResolution: current_repo");
    expect(result.output).toContain(`RepoPath: ${rootDir}`);
    expect(result.output).toContain("audited the current STAX repo root");
  });

  it("answers repo test questions from read-only evidence instead of running linked repo commands", async () => {
    const rootDir = await tempRoot();
    const linkedRepo = path.join(rootDir, "linked-canvas");
    await fs.mkdir(path.join(linkedRepo, "src"), { recursive: true });
    await fs.mkdir(path.join(linkedRepo, "tests"), { recursive: true });
    await fs.writeFile(path.join(linkedRepo, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }), "utf8");
    await fs.writeFile(path.join(linkedRepo, "README.md"), "# Canvas Helper\n\nActive workspace proof.", "utf8");
    await fs.writeFile(path.join(linkedRepo, "tests", "canvas.test.ts"), "expect(true).toBe(true);\n", "utf8");
    await new WorkspaceStore(rootDir).create({ workspace: "canvas-helper", repoPath: "linked-canvas", use: true });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("what tests exist in this repo?");

    expect(result.output).toMatch(/^## Direct Answer/);
    expect(result.output).toContain("pass/fail is unknown");
    expect(result.output).toContain("## One Next Step");
    expect(result.output).toContain("Run `npm test`");
    expect(result.output).toContain("paste back the full output");
    expect(result.output).toContain("ProblemMovement: needs_evidence");
    expect(result.output).toContain("Operation: workspace_repo_audit");
    expect(result.output).toContain("RepoEvidencePack.build");
    expect(result.output).toContain("## Scripts / Test Commands Found");
    expect(result.output).toContain("test: vitest run");
    expect(result.output).toContain("tests/canvas.test.ts");
    expect(result.output).toContain("Tests were not run in the linked repo.");
  });

  it("answers operating-state questions with the highest verified repo risk instead of only listing scripts", async () => {
    const rootDir = await tempRoot();
    const linkedRepo = path.join(rootDir, "linked-canvas");
    await fs.mkdir(path.join(linkedRepo, "src"), { recursive: true });
    await fs.mkdir(path.join(linkedRepo, "scripts", "tests"), { recursive: true });
    await fs.mkdir(path.join(linkedRepo, "docs", "ops"), { recursive: true });
    await fs.writeFile(
      path.join(linkedRepo, "package.json"),
      JSON.stringify({ scripts: { test: "vitest run", typecheck: "tsc --noEmit" } }),
      "utf8"
    );
    await fs.writeFile(path.join(linkedRepo, "README.md"), "# Canvas Helper\n\nActive workspace proof.", "utf8");
    await fs.writeFile(path.join(linkedRepo, "src", "index.ts"), "export const value = 1;\n", "utf8");
    await fs.writeFile(path.join(linkedRepo, "scripts", "tests", "operator.test.ts"), "expect(true).toBe(true);\n", "utf8");
    await fs.writeFile(
      path.join(linkedRepo, "docs", "ops", "ACTIVE_HANDOFF.md"),
      "# Active Handoff\n\n- One red test still fails.\n- Manual browser check still needs validation.\n",
      "utf8"
    );
    await new WorkspaceStore(rootDir).create({ workspace: "canvas-helper", repoPath: "linked-canvas", use: true });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("what is the biggest operational problem right now?");

    expect(result.output).toMatch(/^## Direct Answer/);
    expect(result.output).toContain("Biggest verified operating problem: handoff/validation drift.");
    expect(result.output).toContain("Tests/scripts were found");
    expect(result.output).toContain("pass/fail is unknown");
    expect(result.output).toContain("## One Next Step");
    expect(result.output).toContain("Run `npm run typecheck`");
    expect(result.output).toContain("paste back the full output");
    expect(result.output).toContain("ProblemMovement: needs_evidence");
    expect(result.output).toContain("Operation: workspace_repo_audit");
    expect(result.output).toContain("docs/ops/ACTIVE_HANDOFF.md");
    expect(result.output).not.toContain("STAX found test/script evidence");
  });

  it("does not suggest npm test when no test script exists", async () => {
    const rootDir = await tempRoot();
    const linkedRepo = path.join(rootDir, "linked-admissions");
    await fs.mkdir(linkedRepo, { recursive: true });
    await fs.writeFile(path.join(linkedRepo, "package.json"), JSON.stringify({ scripts: { "build:pages": "node tools/build-pages.js" } }), "utf8");
    await fs.writeFile(path.join(linkedRepo, "README.md"), "# Admissions\n", "utf8");
    await new WorkspaceStore(rootDir).create({ workspace: "app-admissions", repoPath: "linked-admissions", use: true });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("what tests exist in app-admissions and what proof is missing?");

    expect(result.output).toContain("repo-script:build:pages");
    expect(result.output).toContain("Run `npm run build:pages`");
    expect(result.output).not.toContain("Run `npm test`");
  });

  it("does not treat STAX eval command evidence as linked repo proof", async () => {
    const rootDir = await tempRoot();
    const linkedRepo = path.join(rootDir, "linked-canvas");
    await fs.mkdir(path.join(linkedRepo, "scripts", "tests"), { recursive: true });
    await fs.writeFile(
      path.join(linkedRepo, "package.json"),
      JSON.stringify({ scripts: { typecheck: "tsc --noEmit", "test:course-shell": "tsx --test scripts/tests/course-shell.test.ts" } }),
      "utf8"
    );
    await fs.writeFile(path.join(linkedRepo, "README.md"), "# Canvas Helper\n", "utf8");
    await fs.writeFile(path.join(linkedRepo, "scripts", "tests", "course-shell.test.ts"), "expect(true).toBe(true);\n", "utf8");
    await new WorkspaceStore(rootDir).create({ workspace: "canvas-helper", repoPath: "linked-canvas", use: true });
    const store = new CommandEvidenceStore(rootDir);
    await store.record({
      command: "npm run rax -- eval",
      args: ["npm", "run", "rax", "--", "eval"],
      exitCode: 0,
      summary: "STAX eval passed.",
      workspace: "canvas-helper",
      linkedRepoPath: rootDir
    });
    await store.record({
      command: "npm run test:course-shell",
      args: ["npm", "run", "test:course-shell"],
      exitCode: 0,
      summary: "Canvas focused test passed.",
      workspace: "canvas-helper",
      linkedRepoPath: linkedRepo
    });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("what tests exist in canvas-helper and what proof is missing?");

    const storedEvidenceSection = result.output.match(/## Stored Command Evidence[\s\S]*?## Verification Debt/)?.[0] ?? "";
    const receiptEvidenceSection = result.output.match(/## Evidence Checked[\s\S]*?## Artifacts Created/)?.[0] ?? "";
    expect(result.output).toContain("npm run test:course-shell");
    expect(storedEvidenceSection).not.toContain("npm run rax -- eval");
    expect(receiptEvidenceSection).not.toContain("npm run rax -- eval");
  });

  it("audits fake-complete Codex reports instead of routing them as generic repo audits", async () => {
    const rootDir = await tempRoot();
    const linkedRepo = path.join(rootDir, "linked-canvas");
    await fs.mkdir(path.join(linkedRepo, "src"), { recursive: true });
    await fs.writeFile(path.join(linkedRepo, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }), "utf8");
    await fs.writeFile(path.join(linkedRepo, "README.md"), "# Canvas Helper\n", "utf8");
    await new WorkspaceStore(rootDir).create({ workspace: "canvas-helper", repoPath: "linked-canvas", use: true });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("audit this Codex final report for canvas-helper: Codex says it fixed the repo and all tests pass, but provides no file list or command output.");

    expect(result.output).toContain("Operation: codex_report_audit");
    expect(result.output).toContain("supplied Codex report as unverified");
    expect(result.output).toContain("Run `npm test`");
    expect(result.output).toContain("no approval");
  });

  it("creates a bounded Codex prompt candidate from repo evidence without deferring or mutating", async () => {
    const rootDir = await tempRoot();
    const linkedRepo = path.join(rootDir, "linked-brightspace");
    await fs.mkdir(path.join(linkedRepo, "src"), { recursive: true });
    await fs.writeFile(path.join(linkedRepo, "package.json"), JSON.stringify({ scripts: { build: "tsc -b", test: "vitest run" } }), "utf8");
    await fs.writeFile(path.join(linkedRepo, "README.md"), "# Brightspace\n", "utf8");
    await new WorkspaceStore(rootDir).create({ workspace: "brightspacequizexporter", repoPath: "linked-brightspace", use: true });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("create one bounded Codex prompt for brightspacequizexporter based only on current repo evidence; include files to inspect, command to run, acceptance criteria, and stop condition.");

    expect(result.output).toContain("STAX created a bounded Codex prompt candidate");
    expect(result.output).toContain("## Bounded Codex Prompt Candidate");
    expect(result.output).toContain("## Files To Inspect");
    expect(result.output).toContain("## Allowed Tracked File Changes");
    expect(result.output).toContain("## Forbidden Tracked File Changes");
    expect(result.output).toContain("## Commands To Run");
    expect(result.output).toContain("## Reject Run If");
    expect(result.output).toContain("npm test");
    expect(result.output).toContain("Operation: workspace_repo_audit");
    expect(result.output).not.toContain("Deferred. STAX did not execute");
  });

  it("routes slash prompt requests through linked repo evidence when a workspace is named", async () => {
    const rootDir = await tempRoot();
    const linkedRepo = path.join(rootDir, "linked-brightspace");
    await fs.mkdir(path.join(linkedRepo, "scripts", "config"), { recursive: true });
    await fs.mkdir(path.join(linkedRepo, "src", "test", "unit", "ingest"), { recursive: true });
    await fs.writeFile(
      path.join(linkedRepo, "package.json"),
      JSON.stringify({
        scripts: {
          test: "vitest run",
          "ingest:ci": "npm run build && npm run ingest:promotion-check",
          "ingest:promotion-check": "node scripts/ingest-promotion-check.mjs"
        }
      }),
      "utf8"
    );
    await fs.writeFile(
      path.join(linkedRepo, "README.md"),
      [
        "# Brightspace Assessment Factory",
        "",
        "The ingest system is under trust repair: reviewed fixtures are treated as truth, parser output is treated as a candidate snapshot.",
        "Do not assume parser snapshots are gold."
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(path.join(linkedRepo, "scripts", "ingest-promotion-check.mjs"), "console.log('promotion check');\n", "utf8");
    await fs.writeFile(path.join(linkedRepo, "scripts", "config", "frozen-manifests.json"), "[]\n", "utf8");
    await fs.writeFile(path.join(linkedRepo, "src", "test", "unit", "ingest", "ingestBenchmark.test.ts"), "expect(true).toBe(true);\n", "utf8");
    await new WorkspaceStore(rootDir).create({ workspace: "brightspacequizexporter", repoPath: "linked-brightspace", use: false });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine(
      "/prompt For brightspacequizexporter, create one bounded Codex patch prompt based on repo evidence with files to inspect, exactly one command, acceptance criteria, and stop condition."
    );

    expect(result.output).toContain("Operation: workspace_repo_audit");
    expect(result.output).toContain("ingest trust drift");
    expect(result.output).toContain("scripts/ingest-promotion-check.mjs");
    expect(result.output).toContain("scripts/config/frozen-manifests.json");
    expect(result.output).toContain("npm run ingest:ci");
    expect(result.output).toContain("Run `npm run ingest:ci`");
    expect(result.output).toContain("## Allowed Tracked File Changes");
    expect(result.output).toContain("## Forbidden Tracked File Changes");
    expect(result.output).toContain("## Reject Run If");
    expect(result.output).not.toContain("- AGENTS.md");
    expect(result.output).not.toContain("- src/cli.ts");
  });

  it("locks the write surface for Brightspace dependency/install repair prompts", async () => {
    const rootDir = await tempRoot();
    const linkedRepo = path.join(rootDir, "linked-brightspace");
    await fs.mkdir(linkedRepo, { recursive: true });
    await fs.writeFile(
      path.join(linkedRepo, "package.json"),
      JSON.stringify({
        scripts: {
          build: "tsc -b && vite build",
          test: "vitest run",
          "ingest:ci": "npm run build && npm run ingest:promotion-check",
          "ingest:promotion-check": "node scripts/ingest-promotion-check.mjs"
        }
      }),
      "utf8"
    );
    await fs.writeFile(
      path.join(linkedRepo, "package-lock.json"),
      JSON.stringify({
        packages: {
          "node_modules/@rollup/rollup-darwin-arm64": { version: "4.59.0" }
        }
      }),
      "utf8"
    );
    await fs.writeFile(
      path.join(linkedRepo, "README.md"),
      [
        "# Brightspace Assessment Factory",
        "",
        "The ingest system is under trust repair: reviewed fixtures are treated as truth, parser output is treated as a candidate snapshot.",
        "The local and CI ingest gate is npm run ingest:ci."
      ].join("\n"),
      "utf8"
    );
    await new WorkspaceStore(rootDir).create({ workspace: "brightspacequizexporter", repoPath: "linked-brightspace", use: false });
    await new CommandEvidenceStore(rootDir).record({
      command: "npm run ingest:ci",
      exitCode: 1,
      source: "human_pasted_command_output",
      summary: "npm run ingest:ci failed during build. Error: Cannot find module @rollup/rollup-darwin-arm64 from node_modules/rollup/dist/native.js.",
      workspace: "brightspacequizexporter",
      linkedRepoPath: linkedRepo
    });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine(
      "/prompt For brightspacequizexporter, create one bounded Codex patch prompt to repair the dependency install blocker and prove the ingest gate."
    );

    expect(result.output).toContain("dependency/install integrity blocker");
    expect(result.output).toContain("## Allowed Tracked File Changes");
    expect(result.output).toContain("- package-lock.json only if lockfile repair is required.");
    expect(result.output).toContain("- package.json only if absolutely necessary and explicitly justified.");
    expect(result.output).toContain("- tmp/.gitkeep only to preserve or explicitly resolve its current deletion.");
    expect(result.output).toContain("## Forbidden Tracked File Changes");
    expect(result.output).toContain("- src/**");
    expect(result.output).toContain("- scripts/**");
    expect(result.output).toContain("- reviewed fixtures");
    expect(result.output).toContain("- benchmark/gold data");
    expect(result.output).toContain("- tests, unless the test failure is unrelated and explicitly approved later");
    expect(result.output).toContain("## Before Repair");
    expect(result.output).toContain("npm ls @rollup/rollup-darwin-arm64 rollup vite");
    expect(result.output).toContain("## After Repair");
    expect(result.output).toContain("npm run build");
    expect(result.output).toContain("npm run ingest:ci");
    expect(result.output).toContain("## Reject Run If");
    expect(result.output).toContain("Codex runs ingest:seed-gold");
    expect(result.output).toContain("Codex fixes ingest behavior before proving dependency repair");
    expect(result.output).not.toContain("- scripts/ingest-promotion-check.mjs");
    expect(result.output).not.toContain("- src/test/unit/ingest/ingestBenchmark.test.ts");
  });

  it("labels pasted command results as partial user-supplied evidence instead of ignoring them", async () => {
    const rootDir = await tempRoot();
    const linkedRepo = path.join(rootDir, "linked-canvas");
    await fs.mkdir(path.join(linkedRepo, "scripts", "tests"), { recursive: true });
    await fs.writeFile(
      path.join(linkedRepo, "package.json"),
      JSON.stringify({ scripts: { typecheck: "tsc --noEmit", "build:studio": "vite build", "test:course-shell": "tsx --test scripts/tests/course-shell.test.ts" } }),
      "utf8"
    );
    await fs.writeFile(path.join(linkedRepo, "README.md"), "# Canvas Helper\n", "utf8");
    await fs.writeFile(path.join(linkedRepo, "scripts", "tests", "course-shell.test.ts"), "expect(true).toBe(true);\n", "utf8");
    await new WorkspaceStore(rootDir).create({ workspace: "canvas-helper", repoPath: "linked-canvas", use: true });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine(
      "audit canvas-helper after this command evidence: npm run typecheck passed; npx tsx --test scripts/tests/course-shell.test.ts passed 1/1; npm run build:studio passed."
    );

    expect(result.output).toMatch(/^## Direct Answer/);
    const directAnswer = result.output.split("## One Next Step")[0] ?? "";
    expect(result.output).toContain("User-supplied command evidence says");
    expect(result.output).toContain("npm run typecheck passed");
    expect(result.output).toContain("npx tsx --test scripts/tests/course-shell.test.ts passed 1/1");
    expect(result.output).toContain("partial proof for the named commands only");
    expect(result.output).toContain("ProblemMovement: needs_evidence");
    expect(result.output).toContain("Run `npm run test:course-shell`");
    expect(directAnswer).not.toContain("pass/fail is unknown");
    const commandEvidence = await new CommandEvidenceStore(rootDir).list({ workspace: "canvas-helper" });
    expect(commandEvidence.map((item) => item.command).sort()).toEqual([
      "npm run typecheck",
      "npm run build:studio",
      "npx tsx --test scripts/tests/course-shell.test.ts"
    ].sort());
    expect(commandEvidence.every((item) => item.source === "human_pasted_command_output")).toBe(true);
  });

  it("does not repeat a proof command that was already supplied as passed", async () => {
    const rootDir = await tempRoot();
    const linkedRepo = path.join(rootDir, "linked-canvas");
    await fs.mkdir(path.join(linkedRepo, "scripts", "tests"), { recursive: true });
    await fs.writeFile(
      path.join(linkedRepo, "package.json"),
      JSON.stringify({
        scripts: {
          typecheck: "tsc --noEmit",
          "build:studio": "vite build",
          "test:course-shell": "tsx --test scripts/tests/course-shell.test.ts",
          "test:e2e:smoke": "playwright test --grep @smoke"
        }
      }),
      "utf8"
    );
    await fs.writeFile(path.join(linkedRepo, "README.md"), "# Canvas Helper\n", "utf8");
    await fs.writeFile(path.join(linkedRepo, "scripts", "tests", "course-shell.test.ts"), "expect(true).toBe(true);\n", "utf8");
    await new WorkspaceStore(rootDir).create({ workspace: "canvas-helper", repoPath: "linked-canvas", use: true });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine(
      "audit canvas-helper after this command evidence: npm run typecheck passed; npm run test:course-shell passed 4/4; npm run build:studio passed."
    );

    expect(result.output).toContain("npm run test:course-shell passed 4/4");
    expect(result.output).not.toContain("Run `npm run test:course-shell`");
    expect(result.output).toContain("Run `npm run test:e2e:smoke`");
  });

  it("tracks full e2e as verification debt when focused proof exists but full e2e is missing", async () => {
    const rootDir = await tempRoot();
    const linkedRepo = path.join(rootDir, "linked-canvas");
    await fs.mkdir(path.join(linkedRepo, "scripts", "tests"), { recursive: true });
    await fs.writeFile(
      path.join(linkedRepo, "package.json"),
      JSON.stringify({
        scripts: {
          typecheck: "tsc --noEmit",
          "test:course-shell": "tsx --test scripts/tests/course-shell.test.ts",
          "test:e2e": "playwright test -c e2e/playwright.config.ts"
        }
      }),
      "utf8"
    );
    await fs.writeFile(path.join(linkedRepo, "README.md"), "# Canvas Helper\n", "utf8");
    await fs.writeFile(path.join(linkedRepo, "scripts", "tests", "course-shell.test.ts"), "expect(true).toBe(true);\n", "utf8");
    await new WorkspaceStore(rootDir).create({ workspace: "canvas-helper", repoPath: "linked-canvas", use: true });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine(
      "audit canvas-helper after this command evidence: npm run typecheck passed; npm run test:course-shell passed 4/4."
    );

    expect(result.output).toContain("Verification Debt");
    expect(result.output).toContain("npm run test:e2e");
    expect(result.output).toContain("Run `npm run test:e2e`");
    const debts = await new VerificationDebtStore(rootDir).list({ workspace: "canvas-helper" });
    expect(debts[0]?.requiredCommand).toBe("npm run test:e2e");
    expect(debts[0]?.status).toBe("open");
  });

  it("turns fix-this-repo language into an audit plan without mutating the linked repo", async () => {
    const rootDir = await tempRoot();
    const linkedRepo = path.join(rootDir, "linked-canvas");
    await fs.mkdir(path.join(linkedRepo, "src"), { recursive: true });
    await fs.writeFile(path.join(linkedRepo, "package.json"), JSON.stringify({ scripts: { test: "vitest run" } }), "utf8");
    await fs.writeFile(path.join(linkedRepo, "README.md"), "# Canvas Helper\n\nDo not edit me.", "utf8");
    await fs.writeFile(path.join(linkedRepo, "src", "index.ts"), "export const value = 1;\n", "utf8");
    const before = await fs.readdir(linkedRepo, { recursive: true });
    await new WorkspaceStore(rootDir).create({ workspace: "canvas-helper", repoPath: "linked-canvas", use: true });
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("fix this repo");
    const after = await fs.readdir(linkedRepo, { recursive: true });

    expect(result.output).toMatch(/^## Direct Answer/);
    expect(result.output).toContain("STAX did not modify the repo.");
    expect(result.output).toContain("Run `npm test`");
    expect(result.output).toContain("paste back the full output");
    expect(result.output).toContain("Operation: workspace_repo_audit");
    expect(result.output).toContain("Audit and plan next allowed actions");
    expect(result.output).toContain("No source files were modified.");
    expect(result.output).toContain("Do not mutate the linked repo");
    expect(after.sort()).toEqual(before.sort());
  });

  it("does not audit the wrong repo when a named workspace is missing", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("audit canvas-helper");

    expect(result.output).toContain("Operation: audit_workspace");
    expect(result.output).toContain("Workspace audit was not run.");
    expect(result.output).toContain("did not fall back to another repo");
    await expect(fs.stat(path.join(rootDir, "runs"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("shows current judgment items without refreshing or mutating review state", async () => {
    const rootDir = await tempRoot();
    const router = new ReviewRouter(rootDir);
    await router.route(reviewSource(), { apply: true });
    const beforeLedger = await fs.readdir(path.join(rootDir, "review", "ledger"));
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("what needs my judgment?");
    const afterLedger = await fs.readdir(path.join(rootDir, "review", "ledger"));

    expect(result.output).toContain("Operation: judgment_digest");
    expect(result.output).toContain("ReviewQueue.list");
    expect(result.output).toContain("hard_block");
    expect(result.output).toContain("did not refresh, apply, approve, reject, archive, or promote anything");
    expect(afterLedger.sort()).toEqual(beforeLedger.sort());
  });

  it("audits what the last run proved without slash commands", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    await session.handleLine("Codex says runtime behavior changed.");
    const result = await session.handleLine("what did the last run prove?");

    expect(result.output).toContain("Operation: audit_last_proof");
    expect(result.output).toContain("auditLastWithProof");
    expect(result.output).toContain("## Proof Packet");
    expect(result.output).toContain("Mode: codex_audit");
  });

  it("blocks or defers risky and broad natural-language operations", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const blocked = await session.handleLine("approve all memory candidates");
    const deferred = await session.handleLine("stress test planning");

    expect(blocked.output).toMatch(/^## Direct Answer/);
    expect(blocked.output).toContain("Blocked. STAX did not execute");
    expect(blocked.output).toContain("## Proof Status\nblocked");
    expect(blocked.output).toContain("ProblemMovement: blocked");
    expect(deferred.output).toMatch(/^## Direct Answer/);
    expect(deferred.output).toContain("Deferred. STAX did not execute");
    expect(blocked.output).toContain("ExecutionClass: hard_block");
    expect(blocked.output).toContain("No action was executed");
    expect(deferred.output).toContain("ExecutionClass: review_only");
    expect(deferred.output).toContain("Deferred by Chat Operator v1B");
    await expect(fs.stat(path.join(rootDir, "learning", "lab", "runs"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("falls back to the normal runtime for casual chat", async () => {
    const rootDir = await tempRoot();
    const runtime = await createDefaultRuntime({ rootDir });
    const session = new ChatSession(runtime, new MemoryStore(rootDir), rootDir);

    const result = await session.handleLine("hello, can you reason with me?");

    expect(result.output).toContain("Run: run-");
    expect(result.output).not.toContain("## Operator Plan");
  });
});
