import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function readJsonFiles(dir: string): Array<Record<string, unknown>> {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) =>
      JSON.parse(readFileSync(join(dir, name), "utf8")) as Record<string, unknown>
    );
}

describe("staxcore fixture packs", () => {
  it("contains valid redteam fixtures", () => {
    const dir = join(process.cwd(), "tests", "fixtures", "redteam");
    const fixtures = readJsonFiles(dir);

    expect(fixtures.length).toBeGreaterThanOrEqual(6);
    for (const fixture of fixtures) {
      expect(typeof fixture.id).toBe("string");
      expect(fixture.kind).toBe("redteam");
      expect(typeof fixture.input).toBe("string");
      expect(typeof fixture.expected).toBe("object");
    }
  });

  it("contains valid golden fixtures", () => {
    const dir = join(process.cwd(), "tests", "fixtures", "golden");
    const fixtures = readJsonFiles(dir);

    expect(fixtures.length).toBeGreaterThanOrEqual(4);
    for (const fixture of fixtures) {
      expect(typeof fixture.id).toBe("string");
      expect(fixture.kind).toBe("golden");
      expect(typeof fixture.input).toBe("string");
      expect(typeof fixture.expected).toBe("object");
    }
  });
});
