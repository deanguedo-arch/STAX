import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("product surface artifacts", () => {
  it("keeps the public command path to six commands", () => {
    const publicMap = fs.readFileSync(path.join(process.cwd(), "docs/releases/PRODUCT_SURFACE_AMPUTATION/public_surface_map.md"), "utf8");
    const commands = [...publicMap.matchAll(/^- `([^`]+)`/gm)].map((match) => match[1]);

    expect(commands).toEqual([
      "stax attach",
      "stax collect",
      "stax gate",
      "stax status",
      "stax next",
      "stax preflight"
    ]);
  });

  it("keeps rollout and campaign commands classified away from the public path", () => {
    const archiveMap = fs.readFileSync(path.join(process.cwd(), "docs/releases/PRODUCT_SURFACE_AMPUTATION/archive_map.md"), "utf8");

    expect(archiveMap).toContain("INTERNAL_STAX");
    expect(archiveMap).toContain("stax:rollout:gate");
    expect(archiveMap).toContain("INTERNAL_RESEARCH_OR_HISTORY");
    expect(archiveMap).toContain("campaign:*");
  });
});
