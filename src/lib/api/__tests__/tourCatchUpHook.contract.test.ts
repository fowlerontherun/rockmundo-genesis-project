import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("tour catch-up UI boundary", () => {
  it("does not restore browser-side finance or travel writes", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/hooks/useTourCatchUp.ts"),
      "utf8",
    );

    expect(source).toContain("catchUpToTour");
    expect(source).not.toContain('.from("profiles")');
    expect(source).not.toContain('.from("player_travel_history")');
    expect(source).not.toContain(".insert(");
    expect(source).not.toContain(".update(");
  });
});
