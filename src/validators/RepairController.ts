export type RepairResult = {
  attempted: boolean;
  pass: boolean;
  repairedOutput: string;
  issuesRemaining: string[];
  repairCount: number;
};

export class RepairController {
  constructor(private maxRepairPasses = 1) {}

  repair(output: string, issues: string[], currentRepairCount = 0): RepairResult {
    if (currentRepairCount >= this.maxRepairPasses) {
      return {
        attempted: false,
        pass: false,
        repairedOutput: output,
        issuesRemaining: issues,
        repairCount: currentRepairCount
      };
    }

    return {
      attempted: true,
      pass: issues.length === 0,
      repairedOutput: output,
      issuesRemaining: issues,
      repairCount: currentRepairCount + 1
    };
  }
}
