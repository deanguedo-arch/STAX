import fs from "node:fs/promises";
import path from "node:path";

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadMarkdown(
  relativePath: string,
  rootDir = process.cwd()
): Promise<string> {
  const primary = path.resolve(rootDir, relativePath);
  if (await exists(primary)) {
    return fs.readFile(primary, "utf8");
  }

  const fallback = path.resolve(process.cwd(), relativePath);
  if (await exists(fallback)) {
    return fs.readFile(fallback, "utf8");
  }

  return `# Missing Prompt\n${relativePath}`;
}
