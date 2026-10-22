import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FoodArt } from "./FoodArt";

describe("first live recipe ingredient artwork", () => {
  for (const ingredient of ["rice", "soy-seasoning"] as const) {
    it(`renders ${ingredient} and changes its appearance as it cooks`, () => {
      const { container, rerender } = render(<FoodArt id={ingredient} stage="Raw" />);
      const rawMarkup = container.innerHTML;
      expect(container.querySelectorAll("svg g").length).toBeGreaterThan(0);

      rerender(<FoodArt id={ingredient} stage="Ready" />);
      expect(container.innerHTML).not.toBe(rawMarkup);
      expect(container.querySelectorAll("svg g").length).toBeGreaterThan(0);

      rerender(<FoodArt id={ingredient} stage="Burnt" />);
      expect(container.innerHTML).toContain("#c9c4bc");
    });
  }
});
