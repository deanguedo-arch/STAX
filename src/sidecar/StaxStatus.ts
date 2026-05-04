import { printStaxStatus } from "./StaxGate.js";

export async function getStaxStatus(repoPath: string): Promise<string> {
  return printStaxStatus(repoPath);
}
