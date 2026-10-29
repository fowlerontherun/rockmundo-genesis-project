import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FestivalStageAtmosphere } from "./FestivalStageAtmosphere";

describe("festival stage atmosphere artwork", () => {
  it("uses a fixed number of decorative figures, not a reported attendance count", () => {
    const { container } = render(<FestivalStageAtmosphere activePerformance={false} />);
    const crowd = container.querySelector('[data-testid="festival-illustrated-crowd"]');
    expect(crowd?.querySelectorAll('[data-crowd-figure="illustration"]')).toHaveLength(11);
    expect(crowd?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(crowd?.querySelector(".animate-bounce")).toBeNull();
  });

  it("enables reduced-motion-safe animation only with a confirmed performance", () => {
    const { container } = render(<FestivalStageAtmosphere activePerformance />);
    const figures = Array.from(container.querySelectorAll('[data-crowd-figure="illustration"]'));
    expect(figures).toHaveLength(11);
    expect(figures.every((figure) => figure.className.includes("motion-safe:animate-bounce"))).toBe(true);
  });

  it("only draws weather effects when an in-game weather state is supplied", () => {
    const { container, rerender } = render(<FestivalStageAtmosphere activePerformance={false} />);
    expect(container.querySelectorAll("[data-weather-visual]")).toHaveLength(0);
    rerender(<FestivalStageAtmosphere weatherState="light_rain" activePerformance={false} />);
    expect(container.querySelectorAll('[data-weather-visual="rain"]')).toHaveLength(4);
    rerender(<FestivalStageAtmosphere weatherState="heavy_rain" activePerformance={false} />);
    expect(container.querySelectorAll('[data-weather-visual="rain"]')).toHaveLength(8);
  });

  it("shows high-wind and storm motifs only for their reported states", () => {
    const { container, rerender } = render(<FestivalStageAtmosphere weatherState="high_wind" activePerformance={false} />);
    expect(container.querySelectorAll('[data-weather-visual="wind"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-weather-visual="storm"]')).toHaveLength(0);
    rerender(<FestivalStageAtmosphere weatherState="storm" activePerformance={false} />);
    expect(container.querySelectorAll('[data-weather-visual="wind"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-weather-visual="storm"]')).toHaveLength(1);
  });
});
