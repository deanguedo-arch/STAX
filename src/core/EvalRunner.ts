import fs from "node:fs/promises";
import path from "node:path";
import { normalizeText } from "../utils/text.js";
import { createDefaultRuntime } from "./RaxRuntime.js";

export type EvalCaseResult = {
  name: string;
  status: "pass" | "drift" | "missing_expected";
  actual: string;
  expected?: string;
};

export type EvalResult = {
  total: number;
  passed: number;
  failed: number;
  results: EvalCaseResult[];
};

async function listCaseFiles(rootDir: string): Promise<string[]> {
  const caseDir = path.join(rootDir, "evals", "cases");
  try {
    const entries = await fs.readdir(caseDir);
    return entries
      .filter((entry) => /\.(txt|md)$/i.test(entry))
      .map((entry) => path.join(caseDir, entry));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readExpected(rootDir: string, name: string): Promise<string | undefined> {
  const candidates = [
    path.join(rootDir, "evals", "expected", `${name}.md`),
    path.join(rootDir, "goldens", `${name}.md`)
  ];

  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  return undefined;
}

export async function runEvals(options: { rootDir?: string } = {}): Promise<EvalResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const runtime = await createDefaultRuntime({ rootDir });
  const files = await listCaseFiles(rootDir);
  const results: EvalCaseResult[] = [];

  for (const file of files) {
    const name = path.basename(file).replace(/\.(txt|md)$/i, "");
    const input = await fs.readFile(file, "utf8");
    const expected = await readExpected(rootDir, name);
    const output = await runtime.run(input);

    if (expected === undefined) {
      results.push({
        name,
        status: "missing_expected",
        actual: output.output
      });
      continue;
    }

    const actualText = normalizeText(output.output);
    const expectedText = normalizeText(expected);
    results.push({
      name,
      status: actualText === expectedText ? "pass" : "drift",
      actual: output.output,
      expected
    });
  }

  const passed = results.filter((result) => result.status === "pass").length;
  const failed = results.length - passed;
  return {
    total: results.length,
    passed,
    failed,
    results
  };
}
