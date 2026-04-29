import type { ModelProvider } from "../providers/ModelProvider.js";
import type { Mode, RaxConfig } from "../schemas/Config.js";
import { validateModeOutput } from "../utils/validators.js";

export type RepairResult = {
  attempted: boolean;
  pass: boolean;
  repairedOutput: string;
  issuesRemaining: string[];
  repairCount: number;
  providerBacked?: boolean;
};

export class RepairController {
  constructor(private maxRepairPasses = 1) {}

  repair(output: string, issues: string[], currentRepairCount = 0, mode?: Mode): RepairResult {
    if (currentRepairCount >= this.maxRepairPasses) {
      return {
        attempted: false,
        pass: false,
        repairedOutput: output,
        issuesRemaining: issues,
        repairCount: currentRepairCount
      };
    }

    const repairedOutput = repairDeterministically(output, issues, mode);
    const issuesRemaining = issues.filter((issue) => stillPresent(repairedOutput, issue));
    return {
      attempted: true,
      pass: issuesRemaining.length === 0,
      repairedOutput,
      issuesRemaining,
      repairCount: currentRepairCount + 1,
      providerBacked: false
    };
  }

  async repairWithProvider(input: {
    output: string;
    issues: string[];
    mode: Mode;
    originalInput: string;
    provider: ModelProvider;
    config: RaxConfig;
    system?: string;
    evidence?: string[];
    currentRepairCount?: number;
  }): Promise<RepairResult> {
    const currentRepairCount = input.currentRepairCount ?? 0;
    if (currentRepairCount >= this.maxRepairPasses) {
      return {
        attempted: false,
        pass: false,
        repairedOutput: input.output,
        issuesRemaining: input.issues,
        repairCount: currentRepairCount
      };
    }

    const local = this.repair(input.output, input.issues, currentRepairCount, input.mode);
    const localValidation = validateModeOutput(input.mode, local.repairedOutput);
    if (isMockLikeProvider(input.provider.name) || localValidation.valid) {
      return {
        ...local,
        pass: localValidation.valid && local.issuesRemaining.length === 0,
        issuesRemaining: localValidation.valid ? local.issuesRemaining : localValidation.issues
      };
    }

    const providerResponse = await input.provider.complete({
      system: input.system,
      messages: [{
        role: "user",
        content: [
          "Repair this STAX output so it satisfies the mode contract and local critic issues.",
          "Rules:",
          "- Remove unsupported claims; do not invent evidence.",
          "- Do not turn unverified or skipped proof into verified proof.",
          "- Keep the same user-facing mode.",
          "- Return only the repaired final output.",
          "",
          "## Mode",
          input.mode,
          "",
          "## Original User Input",
          input.originalInput,
          "",
          "## Issues",
          ...input.issues.map((issue) => `- ${issue}`),
          "",
          "## Available Evidence",
          ...(input.evidence?.length ? input.evidence.map((item) => `- ${item}`) : ["- No extra evidence supplied."]),
          "",
          "## Failed Output",
          input.output
        ].join("\n")
      }],
      temperature: input.config.model.generationTemperature,
      top_p: input.config.model.topP,
      seed: input.config.model.seed,
      maxTokens: input.config.model.maxOutputTokens,
      timeoutMs: input.config.model.timeoutMs
    });
    const repairedOutput = providerResponse.text.trim();
    const validation = validateModeOutput(input.mode, repairedOutput);
    return {
      attempted: true,
      pass: validation.valid,
      repairedOutput,
      issuesRemaining: validation.issues,
      repairCount: currentRepairCount + 1,
      providerBacked: true
    };
  }
}

function repairDeterministically(output: string, issues: string[], mode?: Mode): string {
  let repaired = output.trim();
  for (const claim of unsupportedClaims(issues)) {
    repaired = repaired
      .split(/\r?\n/)
      .filter((line) => !line.toLowerCase().includes(claim.toLowerCase()))
      .join("\n")
      .trim();
  }
  for (const heading of missingHeadings(issues)) {
    if (!repaired.includes(heading)) {
      repaired = [repaired, "", heading, fallbackHeadingContent(mode, heading)].join("\n").trim();
    }
  }
  return repaired;
}

function unsupportedClaims(issues: string[]): string[] {
  return issues.flatMap((issue) => {
    const match = issue.match(/Unsupported claim:\s*(.+)$/i);
    return match?.[1] ? [match[1].trim()] : [];
  });
}

function missingHeadings(issues: string[]): string[] {
  return issues.flatMap((issue) => {
    const match = issue.match(/Missing required heading:\s*(##\s+.+)$/i);
    return match?.[1] ? [match[1].trim()] : [];
  });
}

function fallbackHeadingContent(mode: Mode | undefined, heading: string): string {
  if (mode === "planning") {
    if (heading === "## Files To Create Or Modify") return "- No file target supplied yet; collect repo evidence before naming files.";
    if (heading === "## Tests / Evals To Add") return "- Add a focused test or eval after the bounded target is known.";
    if (heading === "## Commands To Run") return "- npm run typecheck\n- npm test";
  }
  return "- Not verified from supplied evidence.";
}

function stillPresent(output: string, issue: string): boolean {
  const claim = unsupportedClaims([issue])[0];
  if (claim) return output.toLowerCase().includes(claim.toLowerCase());
  const heading = missingHeadings([issue])[0];
  if (heading) return !output.includes(heading);
  return true;
}

function isMockLikeProvider(name: string): boolean {
  return name === "mock" || name.startsWith("mock-");
}
