import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const flags = vi.hoisted(() => ({
  current: {
    legacyFestivalSystemEnabled: true,
    legacyFestivalReadEnabled: true,
    legacyFestivalWriteEnabled: false,
    newFestivalSystemEnabled: true,
    festivalCreationEnabled: true,
    festivalApplicationsEnabled: true,
    festivalLivePerformanceEnabled: true,
  },
}));

vi.mock("../config/featureFlags", () => ({
  useFestivalFeatureFlags: () => flags.current,
}));

import { LegacyFestivalGate } from "../ui/LegacyFestivalGate";

const renderGate = (area?: string) => render(
  <MemoryRouter>
    <LegacyFestivalGate area={area}>
      <div>legacy-content</div>
    </LegacyFestivalGate>
  </MemoryRouter>,
);

describe("LegacyFestivalGate", () => {
  beforeEach(() => {
    flags.current = {
      legacyFestivalSystemEnabled: true,
      legacyFestivalReadEnabled: true,
      legacyFestivalWriteEnabled: false,
      newFestivalSystemEnabled: true,
      festivalCreationEnabled: true,
      festivalApplicationsEnabled: true,
      festivalLivePerformanceEnabled: true,
    };
  });

  it("does not mount legacy gameplay while legacy writes are disabled by default", () => {
    renderGate("Festival performance");

    expect(screen.queryByText("legacy-content")).not.toBeInTheDocument();
    expect(screen.getByText(/Legacy Festival actions are read-only/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open current Festivals/i })).toHaveAttribute("href", "/world/festivals");
  });

  it("renders children only when legacy reads and writes are explicitly enabled", () => {
    flags.current = {
      ...flags.current,
      legacyFestivalWriteEnabled: true,
    };

    renderGate();

    expect(screen.getByText("legacy-content")).toBeInTheDocument();
  });

  it("renders the rebuilding screen when legacy reads are disabled", () => {
    flags.current = {
      ...flags.current,
      legacyFestivalReadEnabled: false,
    };

    renderGate("Browser");

    expect(screen.queryByText("legacy-content")).not.toBeInTheDocument();
    expect(screen.getByText(/Festivals are being rebuilt/i)).toBeInTheDocument();
  });
});
