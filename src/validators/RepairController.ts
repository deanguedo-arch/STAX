export type RepairResult = {
  output: string;
  repaired: boolean;
  issues: string[];
};

export class RepairController {
  repair(output: string, issues: string[]): RepairResult {
    return {
      output,
      repaired: false,
      issues
    };
  }
}
