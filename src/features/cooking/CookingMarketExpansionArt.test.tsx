import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CookingMarketExpansionArt, marketStallCount } from "./CookingMarketExpansionArt";

afterEach(cleanup);

describe("city market improvements artwork", () => {
  it("draws additional market stalls as a mayor increases the level", () => {
    for (let level = 1; level <= 5; level++) {
      const { unmount } = render(<CookingMarketExpansionArt level={level} />);
      const picture = screen.getByRole("img", { name: new RegExp("Level "+level+" food marketplace") });
      expect(picture).toHaveAttribute("data-stall-count", String(level + 1));
      expect(screen.getAllByTestId("cooking-market-stall")).toHaveLength(level + 1);
      unmount();
    }
  });
  it("clamps unexpected or stale level numbers rather than displaying infinite stalls", () => {
    expect(marketStallCount(-4)).toBe(2);
    expect(marketStallCount(0)).toBe(2);
    expect(marketStallCount(2.8)).toBe(3);
    expect(marketStallCount(99)).toBe(6);
    expect(marketStallCount(Number.NaN)).toBe(2);
    expect(marketStallCount(Number.POSITIVE_INFINITY)).toBe(2);
  });
  it("uses only local SVG shapes, with no paid or interactive elements", () => {
    render(<CookingMarketExpansionArt level={5} />);
    expect(document.querySelectorAll("svg")).toHaveLength(1);
    expect(document.querySelectorAll("img, button")).toHaveLength(0);
  });
});
