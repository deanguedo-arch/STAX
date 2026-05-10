import { describe, expect, it } from "vitest";
import {
  gitCommand,
  npmCommand,
  renderStructuredCommand
} from "../../src/security/StructuredCommand.js";

describe("StructuredCommand", () => {
  it("renders an allowed npm command without shell parsing", () => {
    const command = npmCommand(process.cwd(), ["run", "typecheck"]);
    expect(renderStructuredCommand(command)).toBe("npm run typecheck");
  });

  it("rejects shell metacharacters in command arguments", () => {
    expect(() =>
      npmCommand(process.cwd(), ["run", "typecheck; rm -rf /"])
    ).toThrow(/unsafe argument/);
  });

  it("rejects unapproved npm scripts", () => {
    expect(() => npmCommand(process.cwd(), ["run", "postinstall"])).toThrow(
      /Unsupported npm script/
    );
  });

  it("allows bounded git evidence commands", () => {
    const command = gitCommand(process.cwd(), [
      "-C",
      process.cwd(),
      "status",
      "--short"
    ]);
    expect(renderStructuredCommand(command)).toContain("git -C");
  });
});
