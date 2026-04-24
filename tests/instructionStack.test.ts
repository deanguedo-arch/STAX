import { describe, expect, it } from "vitest";
import { InstructionStack } from "../src/core/InstructionStack.js";

describe("InstructionStack", () => {
  it("loads markdown prompts for a mode", async () => {
    const stack = await new InstructionStack(process.cwd()).build({
      userInput: "Extract this signal",
      mode: "intake"
    });

    expect(stack.system).toContain("RAX Core Runtime");
    expect(stack.system).toContain("Intake Agent");
    expect(stack.system).toContain("Signal Extract Task");
  });
});
