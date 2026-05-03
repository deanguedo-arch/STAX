import { describe, expect, it } from "vitest";
import { analyzeProjectControlCodexPrompt } from "../src/projectControl/CodexPromptQuality.js";

describe("codex prompt quality", () => {
  it("accepts a bounded repo-anchored proof prompt", () => {
    const result = analyzeProjectControlCodexPrompt({
      prompt: [
        "```txt",
        "Work only in /Users/deanguedo/Documents/GitHub/STAX.",
        "Do not commit or push.",
        "Run exactly: npm run typecheck",
        "Return cwd, exact command, exit code, and output.",
        "```"
      ].join("\n"),
      requiresRiskGuardrails: true
    });

    expect(result.status).toBe("strong");
    expect(result.issues).toEqual([]);
  });

  it("flags prompts that are broad and artifact-free", () => {
    const result = analyzeProjectControlCodexPrompt({
      prompt: "Fix everything in the repo and tell me when it's done."
    });

    expect(result.status).toBe("weak");
    expect(result.issues.join("\n")).toContain("explicit repo/root");
    expect(result.issues.join("\n")).toContain("proof artifacts");
  });

  it("flags risky prompts that omit guardrails", () => {
    const result = analyzeProjectControlCodexPrompt({
      prompt: [
        "```txt",
        "Work only in /Users/deanguedo/Documents/GitHub/ADMISSION-APP.",
        "Run exactly one preflight command and return cwd, exact command, exit code, and output.",
        "```"
      ].join("\n"),
      requiresRiskGuardrails: true
    });

    expect(result.status).toBe("partial");
    expect(result.issues.join("\n")).toContain("forbidden-action guardrails");
  });
});
