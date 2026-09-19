import { describe, expect, it } from "vitest";
import { buildTotpCreditLines } from "./TotpEndCredits";
import type { TotpBroadcastReplay } from "./api";

const replay = (bandName: string, songTitle: string) => ({
  id: `replay-${bandName}`,
  presenter_key: "alex_rayne",
  payload: { presenterKey: "alex_rayne", band: { name: bandName }, song: { title: songTitle } },
}) as unknown as TotpBroadcastReplay;

describe("Top of the Pops end credits", () => {
  it("credits the presenter, every act and the production", () => {
    const lines = buildTotpCreditLines([replay("Shockmaster", "Dead Radio"), replay("Neon Vows", "Glass Parade")]);
    expect(lines[0]).toContain("Presented by");
    expect(lines).toContain('Shockmaster — "Dead Radio"');
    expect(lines).toContain('Neon Vows — "Glass Parade"');
    expect(lines.at(-1)).toBe("A RockMundo Television production");
  });

  it("still produces a valid roll with no acts", () => {
    const lines = buildTotpCreditLines([]);
    expect(lines.some((line) => line.includes("Tonight's line-up"))).toBe(false);
    expect(lines.at(-1)).toBe("A RockMundo Television production");
  });
});
