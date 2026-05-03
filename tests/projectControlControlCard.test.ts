import { describe, expect, it } from "vitest";
import {
  projectControlStatusFromWhy,
  validateProjectControlCardShape
} from "../src/projectControl/ControlCard.js";
import { ProjectControlValidator } from "../src/validators/ProjectControlValidator.js";

function validCard(input: {
  why: string;
  verified?: string;
  weak?: string;
  unverified?: string;
  risk?: string;
  action?: string;
  prompt?: string;
}): string {
  return [
    "## Verdict",
    `- Status: ${projectControlStatusFromWhy(input.why)}`,
    `- Why: ${input.why}`,
    "",
    "## Verified",
    `- ${input.verified ?? "The task target and supplied evidence scope are known."}`,
    "",
    "## Weak / Provisional",
    `- ${input.weak ?? "Codex report content remains provisional until local proof exists."}`,
    "",
    "## Unverified",
    `- ${input.unverified ?? "Runtime behavior remains unverified until command or artifact evidence is supplied."}`,
    "",
    "## Risk",
    `- ${input.risk ?? "A fake-complete claim could be accepted without proof."}`,
    "",
    "## One Next Action",
    `- ${input.action ?? "Run one bounded proof command in the target repo and capture the exit code."}`,
    "",
    "## Codex Prompt if needed",
    input.prompt ?? "Run only the smallest safe proof step, paste back cwd, command, exit code, and output tail, and stop before mutation."
  ].join("\n");
}

describe("project control control card", () => {
  it("classifies verdict reasons into stable control-card statuses", () => {
    expect(projectControlStatusFromWhy("Clean failure, not fake-complete; pwsh is unavailable.")).toBe("Clean failure");
    expect(projectControlStatusFromWhy("Not proven; no local command evidence was supplied.")).toBe("Reject");
    expect(projectControlStatusFromWhy("Validation-backed but not campaign-complete.")).toBe("Provisional");
    expect(projectControlStatusFromWhy("Human review required before promotion.")).toBe("Human review");
    expect(projectControlStatusFromWhy("Validated and proven with local command evidence.")).toBe("Accept");
  });

  it("validates a 50-case control-card fixture matrix", () => {
    const validCases = Array.from({ length: 41 }, (_, index) =>
      validCard({
        why: [
          "Not proven; no local command evidence was supplied.",
          "Clean failure, not fake-complete; the preflight could not run because pwsh is unavailable.",
          "Validation-backed but not campaign-complete; one workflow gate remains open.",
          "Human review required before promotion because approval metadata is missing.",
          "Validated and proven with local command evidence."
        ][index % 5]!,
        verified: `The case fixture target ${index + 1} is known.`,
        action: [
          "Run one bounded proof command in the target repo and capture the exit code.",
          "Ask Codex for the exact repo root and the smallest safe proof command.",
          "Inspect the diff and confirm the changed files match the stated task.",
          "Capture a rendered screenshot and visual checklist finding before approval.",
          "Collect the command output, cwd, branch, and output tail, then stop."
        ][index % 5]!
      })
    );

    const invalidCases = [
      validCard({ why: "Not proven; no local command evidence was supplied." }).replace("- Why:", "- Because:"),
      validCard({ why: "Not proven; no local command evidence was supplied." }).replace("- Status: Reject", "- Status: Unknown"),
      validCard({ why: "Not proven; no local command evidence was supplied." }).replace("## One Next Action\n- ", "## One Next Action\n- Run one bounded proof command.\n- "),
      validCard({ why: "Too short." }),
      validCard({ why: "Not proven; no local command evidence was supplied.", action: "Think about it." }),
      validCard({ why: "Not proven; no local command evidence was supplied." }).replace("## Verified\n- ", "## Verified\n"),
      validCard({ why: "Not proven; no local command evidence was supplied.", prompt: "Nope." }),
      validCard({ why: "Not proven; no local command evidence was supplied.", prompt: "Fix everything in the repo." }),
      [
        "## Verdict",
        "- Status: Reject",
        "- Why: Not proven; no local command evidence was supplied.",
        "",
        "## Verified",
        "- Target repo path supplied.",
        "",
        "## Weak / Provisional",
        "- Codex report only.",
        "",
        "## Unverified",
        "- None.",
        "",
        "## Risk",
        "- Fake-complete risk.",
        "",
        "## One Next Action",
        "- Run npm test and capture output.",
        "",
        "## Codex Prompt if needed",
        "Run npm test and report output."
      ].join("\n")
    ];

    const allCases = [...validCases, ...invalidCases];
    expect(allCases).toHaveLength(50);

    for (const [index, output] of allCases.entries()) {
      if (index < validCases.length) {
        const issues = validateProjectControlCardShape(output);
        expect(issues, `valid control-card case ${index + 1}`).toEqual([]);
      } else {
        const validator = new ProjectControlValidator();
        const issues = index === allCases.length - 1
          ? validator.validate(output).issues
          : validateProjectControlCardShape(output);
        expect(issues.length, `invalid control-card case ${index + 1}`).toBeGreaterThan(0);
      }
    }
  });

  it("requires status and why lines in validated project-control output", () => {
    const validator = new ProjectControlValidator();
    const valid = validator.validate(validCard({ why: "Not proven; no local command evidence was supplied." }));
    expect(valid.valid).toBe(true);

    const invalid = validator.validate(
      [
        "## Verdict",
        "- Not proven; no local command evidence was supplied.",
        "",
        "## Verified",
        "- None.",
        "",
        "## Weak / Provisional",
        "- Codex report only.",
        "",
        "## Unverified",
        "- Tests remain unverified.",
        "",
        "## Risk",
        "- Fake-complete risk.",
        "",
        "## One Next Action",
        "- Run npm test and paste the output.",
        "",
        "## Codex Prompt if needed",
        "Run npm test."
      ].join("\n")
    );

    expect(invalid.valid).toBe(false);
    expect(invalid.issues).toContain("Project control output must include a Verdict status line.");
    expect(invalid.issues).toContain("Project control output must include a Verdict why line.");
  });

  it("rejects unbounded or empty Codex prompts in validator output", () => {
    const validator = new ProjectControlValidator();

    const emptyPrompt = validator.validate(
      validCard({
        why: "Not proven; no local command evidence was supplied.",
        prompt: "Too short."
      })
    );
    expect(emptyPrompt.valid).toBe(false);
    expect(emptyPrompt.issues).toContain("Project control Codex prompt must be present and copy-pasteable when needed.");

    const broadPrompt = validator.validate(
      validCard({
        why: "Not proven; no local command evidence was supplied.",
        prompt: "Fix everything in the repo and tell me when it's done."
      })
    );
    expect(broadPrompt.valid).toBe(false);
    expect(broadPrompt.issues).toContain("Project control Codex prompt must stay bounded and must not ask Codex to fix everything.");
  });
});
