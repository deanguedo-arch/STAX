import { spawn } from "node:child_process";
import path from "node:path";
import { readTextIfExists, sidecarDir, validateRepoPath } from "./SidecarRepo.js";
import { runStaxGate } from "./StaxGate.js";

export type NextCodexPromptResult = {
  repoPath: string;
  prompt: string;
  copied: boolean;
  copyError?: string;
};

export async function getNextCodexPrompt(options: {
  repoPath: string;
  copy?: boolean;
  runGate?: boolean;
}): Promise<NextCodexPromptResult> {
  const repoPath = await validateRepoPath(options.repoPath);
  if (options.runGate ?? true) {
    await runStaxGate({ repoPath });
  }

  const promptPath = path.join(sidecarDir(repoPath), "next-codex-prompt.md");
  const prompt = (await readTextIfExists(promptPath)).trimEnd();
  if (!prompt.trim()) {
    throw new Error(`No next Codex prompt found at ${promptPath}. Run stax:gate first.`);
  }

  if (!options.copy) {
    return { repoPath, prompt, copied: false };
  }

  try {
    await copyWithPbcopy(prompt);
    return { repoPath, prompt, copied: true };
  } catch (error) {
    const copyError = error instanceof Error ? error.message : String(error);
    return { repoPath, prompt, copied: false, copyError };
  }
}

function copyWithPbcopy(prompt: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("pbcopy", [], { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `pbcopy exited ${code ?? "unknown"}`));
    });
    child.stdin.end(prompt);
  });
}
