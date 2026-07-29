import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve("src/services/profileService.ts"), "utf8");

describe("active profile selection", () => {
  it("deterministically selects one active profile when legacy data contains duplicates", () => {
    const activeProfileQuery = source.slice(
      source.indexOf("export async function getActiveProfile"),
      source.indexOf("export async function getFirstLivingProfile"),
    );

    expect(activeProfileQuery).toContain('.order("updated_at"');
    expect(activeProfileQuery).toContain('.order("created_at"');
    expect(activeProfileQuery).toContain('.order("id"');
    expect(activeProfileQuery).toContain(".limit(1)");
    expect(activeProfileQuery.indexOf(".limit(1)")).toBeLessThan(
      activeProfileQuery.indexOf(".maybeSingle()"),
    );
  });
});
