import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("useTourCancellation authority boundary", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/hooks/useTourCancellation.ts"),
    "utf8",
  );

  it("uses the authoritative cancellation RPC", () => {
    expect(source).toContain('"cancel_tour"');
    expect(source).toContain("p_tour_id");
  });

  it("does not directly mutate tour, gig or band finance tables", () => {
    expect(source).not.toMatch(/\.from\(["']tours["']\)/);
    expect(source).not.toMatch(/\.from\(["']gigs["']\)/);
    expect(source).not.toMatch(/\.from\(["']bands["']\)/);
    expect(source).not.toContain("band_balance");
  });

  it("uses UK currency formatting for refunds", () => {
    expect(source).toContain('toLocaleString("en-GB")');
    expect(source).toContain("£");
  });
});
