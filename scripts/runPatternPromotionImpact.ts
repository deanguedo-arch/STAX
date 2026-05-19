import path from "node:path";
import {
  readImpactEvidenceBundle,
  readLockedReplayImpactFixture,
  writePatternPromotionImpactReport
} from "../src/learning/PatternPromotionImpactTracker.js";

function argValues(argv: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === name && argv[index + 1]) {
      values.push(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith(`${name}=`)) {
      values.push(arg.slice(`${name}=`.length));
    }
  }
  return values;
}

function argValue(argv: string[], name: string): string | undefined {
  return argValues(argv, name)[0];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const staxRoot = process.cwd();
  const fixturePath = path.resolve(
    staxRoot,
    argValue(argv, "--fixture") ?? path.join("fixtures", "pattern_promotion", "locked_replay_10_cases.json")
  );
  const importPaths = argValues(argv, "--import").map((value) => path.resolve(staxRoot, value));
  const lockedReplayFixture = argv.includes("--current-only") ? undefined : await readLockedReplayImpactFixture(fixturePath);
  const importedEvidenceBundles = [];
  for (const importPath of importPaths) {
    importedEvidenceBundles.push(await readImpactEvidenceBundle(importPath));
  }

  const result = await writePatternPromotionImpactReport({
    staxRoot,
    lockedReplayFixture,
    importedEvidenceBundles
  });

  const summary = {
    reportPath: result.markdownPath,
    jsonPath: result.jsonPath,
    lockedReplay: {
      cases: result.report.lockedReplay.caseCount,
      criticalMisses: result.report.lockedReplay.criticalMisses,
      improved: result.report.lockedReplay.improved,
      unchangedSafe: result.report.lockedReplay.unchangedSafe,
      regressed: result.report.lockedReplay.regressed
    },
    currentOperatingWindow: {
      importedBundles: result.report.currentOperatingWindow.importedBundleCount,
      criticalMisses: result.report.currentOperatingWindow.criticalMisses,
      fullHandoffContracts: result.report.currentOperatingWindow.fullHandoffContracts,
      proofArtifactsRequested: result.report.currentOperatingWindow.proofArtifactsRequested
    }
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (result.report.lockedReplay.criticalMisses > 0 || result.report.currentOperatingWindow.criticalMisses > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
