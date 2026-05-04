import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function createTempGitRepo(prefix: string): Promise<string> {
  const repoPath = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  execFileSync("git", ["init"], { cwd: repoPath });
  execFileSync("git", ["config", "user.email", "stax@example.test"], { cwd: repoPath });
  execFileSync("git", ["config", "user.name", "STAX Test"], { cwd: repoPath });
  await fs.writeFile(path.join(repoPath, "README.md"), "# test repo\n", "utf8");
  execFileSync("git", ["add", "README.md"], { cwd: repoPath });
  execFileSync("git", ["commit", "-m", "initial"], { cwd: repoPath });
  return repoPath;
}

export async function commitFile(repoPath: string, filePath: string, content: string): Promise<void> {
  const fullPath = path.join(repoPath, filePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf8");
  execFileSync("git", ["add", filePath], { cwd: repoPath });
  execFileSync("git", ["commit", "-m", `add ${filePath}`], { cwd: repoPath });
}
