import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrowdTuningPanel, isGigViewerDemoRoute } from "../CrowdTuningPanel";
import { DEFAULT_CROWD_TUNING } from "../engine/CrowdTuning";

describe("crowd tuning demo controls", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("only identifies the admin gig viewer demo route", () => {
    window.history.replaceState({}, "", "/admin/gig-viewer-demo");
    expect(isGigViewerDemoRoute()).toBe(true);
    window.history.replaceState({}, "", "/gigs/fixture");
    expect(isGigViewerDemoRoute()).toBe(false);
  });

  it("renders presets, live metrics, and every crowd control", () => {
    render(
      <CrowdTuningPanel
        value={{ ...DEFAULT_CROWD_TUNING }}
        onChange={vi.fn()}
        attendance={250}
        capacity={500}
      />,
    );

    expect(screen.getByText("Crowd packing lab")).toBeInTheDocument();
    expect(screen.getByText("500 visual fans")).toBeInTheDocument();
    expect(screen.getByText("50% attendance")).toBeInTheDocument();
    expect(screen.getByLabelText("Crowd tuning preset")).toBeInTheDocument();
    for (const label of [
      "Visual density",
      "Front-to-back spread",
      "Side-to-side spread",
      "Stage pull",
      "Position randomness",
      "Fan marker size",
      "Arrival speed",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});
