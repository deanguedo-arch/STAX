import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveNestedCommand,
  runStaxCoreCheck
} from "../../src/staxcore/core/release/ReleaseCommandRunner.js";

describe("staxcore release command runner", () => {
  it("runs generic executable checks and captures passing output", async () => {
    const root = await mkdtemp(join(tmpdir(), "staxcore-command-runner-"));

    const result = await runStaxCoreCheck("typecheck", [
      process.execPath,
      "-e",
      "process.stdout.write('ok')"
    ], root);

    expect(result.passed).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdoutPreview).toBe("ok");
  });

  it("runs npm through the npm CLI entrypoint when available", () => {
    const resolved = resolveNestedCommand(["npm", "run", "typecheck"], {
      nodePath: "/node/bin/node",
      npmExecPath: "/node/lib/node_modules/npm/bin/npm-cli.js"
    });

    expect(resolved.command).toBe("/node/bin/node");
    expect(resolved.args).toEqual([
      "/node/lib/node_modules/npm/bin/npm-cli.js",
      "run",
      "typecheck"
    ]);
  });

  it("falls back to cmd.exe on Windows when the npm CLI entrypoint is unavailable", () => {
    const resolved = resolveNestedCommand(["npm", "test"], {
      platform: "win32",
      nodePath: "C:/node/node.exe"
    });

    expect(resolved.command).toBe("cmd.exe");
    expect(resolved.args).toEqual(["/d", "/s", "/c", "npm", "test"]);
  });
});
