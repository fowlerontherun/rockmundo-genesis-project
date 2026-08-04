import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlobalCrowdDefaultsControls } from "../GlobalCrowdDefaultsControls";
import { DEFAULT_CROWD_TUNING } from "../engine/CrowdTuning";

const mockState = vi.hoisted(() => ({
  globalSettings: {
    densityMultiplier: 2,
    depthSpread: 1,
    lateralSpread: 1,
    stagePull: 0,
    randomness: 0,
    fanScale: 1,
    arrivalSpeed: 1,
  },
}));

vi.mock("../hooks/useGlobalCrowdTuning", () => ({
  useGlobalCrowdTuning: () => ({
    data: {
      revision: 4,
      settings: mockState.globalSettings,
      updatedAt: "2026-08-04T12:00:00Z",
      updatedBy: "admin-user",
      reason: "Previous crowd balance",
    },
    isError: false,
  }),
  useSaveGlobalCrowdTuning: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useRestoreGlobalCrowdTuning: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

describe("global crowd defaults controls", () => {
  it("shows the active revision and exposes guarded production actions", () => {
    render(
      <GlobalCrowdDefaultsControls
        value={{ ...DEFAULT_CROWD_TUNING, densityMultiplier: 3 }}
        onLoad={vi.fn()}
      />,
    );

    expect(screen.getByText("Global gig crowd defaults")).toBeInTheDocument();
    expect(screen.getByText("Revision 4")).toBeInTheDocument();
    expect(screen.getByText("Unsaved demo changes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save as global default" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Restore system defaults" })).toBeEnabled();
  });

  it("loads the saved global values back into the demo", () => {
    const onLoad = vi.fn();
    render(
      <GlobalCrowdDefaultsControls
        value={{ ...DEFAULT_CROWD_TUNING, densityMultiplier: 3 }}
        onLoad={onLoad}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Load global into demo" }));
    expect(onLoad).toHaveBeenCalledWith(mockState.globalSettings);
  });
});
