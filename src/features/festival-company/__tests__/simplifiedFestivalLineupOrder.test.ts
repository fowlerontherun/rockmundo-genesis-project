import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(
    process.cwd(),
    "src/features/festival-company/ui/FestivalArtistPlanner.tsx",
  ),
  "utf8",
);

describe("simplified Festival line-up order", () => {
  it("does not require player-configured tickets before the line-up", () => {
    expect(source).not.toContain(
      "Complete the Festival plan and tickets before choosing the line-up.",
    );
    expect(source).toContain("Complete the annual Festival Plan");
    expect(source).toContain("ticket foundation automatically");
    expect(source).toContain("Tickets & budget");
  });

  it("keeps only the core line-up decisions prominent", () => {
    expect(source).toContain("Line-up method");
    expect(source).toContain("Total artist budget");
    expect(source).toContain("Optional artist targeting");
    expect(source).toContain("<details");
  });
});
