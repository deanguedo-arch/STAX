import fs from "node:fs/promises";
import path from "node:path";
import { evaluateProperties } from "../evaluators/PropertyEvaluator.js";
import type { RaxMode } from "../schemas/Config.js";
import { normalizeText } from "../utils/text.js";
import { createDefaultRuntime } from "./RaxRuntime.js";

export type EvalCaseResult = {
  name: string;
  status: "pass" | "drift" | "missing_expected" | "property_fail";
  actual: string;
  expected?: string;
  failReasons?: string[];
  critical?: boolean;
};

export type EvalResult = {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  criticalFailures: number;
  results: EvalCaseResult[];
};

export type EvalCase = {
  id: string;
  mode: string;
  input: string;
  expectedProperties: string[];
  forbiddenPatterns: string[];
  requiredSections: string[];
  requiredSignals?: string[];
  minSignalUnits?: number;
  expectedBoundaryMode?: "allow" | "constrain" | "refuse" | "redirect";
  critical: boolean;
  tags: string[];
};

async function listCaseFiles(rootDir: string, folder = "cases"): Promise<string[]> {
  const caseDir = path.join(rootDir, "evals", folder);
  try {
    const entries = await fs.readdir(caseDir);
    return entries
      .filter((entry) => /\.(txt|md|json)$/i.test(entry))
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

export async function runEvals(
  options: {
    rootDir?: string;
    folder?: "cases" | "redteam" | "regression";
    mode?: string;
    workspace?: string;
    linkedRepoPath?: string;
  } = {}
): Promise<EvalResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const runtime = await createDefaultRuntime({ rootDir });
  const files = await listCaseFiles(rootDir, options.folder ?? "cases");
  const results: EvalCaseResult[] = [];

  for (const file of files) {
    const name = path.basename(file).replace(/\.(txt|md|json)$/i, "");
    const raw = await fs.readFile(file, "utf8");
    const jsonCase = file.endsWith(".json") ? (JSON.parse(raw) as EvalCase) : undefined;
    if (jsonCase && options.mode && jsonCase.mode !== options.mode) {
      continue;
    }
    const input = jsonCase?.input ?? raw;
    const expected = jsonCase ? undefined : await readExpected(rootDir, name);
    const output = await runtime.run(
      input,
      [],
      {
        ...(jsonCase ? { mode: jsonCase.mode as RaxMode } : {}),
        workspace: options.workspace,
        linkedRepoPath: options.linkedRepoPath
      }
    );

    if (jsonCase) {
      const property = evaluateProperties({
        output: output.output,
        requiredSections: jsonCase.requiredSections,
        forbiddenPatterns: jsonCase.forbiddenPatterns,
        expectedProperties: jsonCase.expectedProperties,
        minSignalUnits: jsonCase.minSignalUnits,
        critical: jsonCase.critical,
        expectedBoundaryMode: jsonCase.expectedBoundaryMode,
        actualBoundaryMode: output.mode,
        providerCallCount: output.agent === "boundary" ? 0 : undefined
      });
      results.push({
        name: jsonCase.id,
        status: property.pass ? "pass" : "property_fail",
        actual: output.output,
        failReasons: property.failReasons,
        critical: jsonCase.critical
      });
      continue;
    }

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
  const criticalFailures = results.filter(
    (result) => result.critical && result.status !== "pass"
  ).length;
  const passRate = results.length ? passed / results.length : 1;
  await writeEvalResult(rootDir, {
    total: results.length,
    passed,
    failed,
    passRate,
    criticalFailures,
    results
  });
  return {
    total: results.length,
    passed,
    failed,
    passRate,
    criticalFailures,
    results
  };
}

async function writeEvalResult(rootDir: string, result: EvalResult): Promise<void> {
  const dir = path.join(rootDir, "evals", "eval_results");
  await fs.mkdir(dir, { recursive: true });
  const suffix = Math.random().toString(36).slice(2, 8);
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${suffix}.json`);
  await fs.writeFile(file, JSON.stringify(result, null, 2), "utf8");
}
