import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let queryState: any;

vi.mock("@/hooks/useBandContributions", () => ({
  useBandContributions: () => queryState,
}));

import { BandContributionsTab } from "./BandContributionsTab";

const event = {
  id: "event-1",
  band_id: "band-1",
  profile_id: "profile-1",
  contribution_type: "rehearsal_attendance",
  source_entity_type: "band_rehearsal",
  source_entity_id: "rehearsal-1",
  occurred_at: "2026-07-10T10:00:00Z",
  metadata: { label: "Completed band rehearsal" },
  created_at: "2026-07-10T10:00:01Z",
  profiles: { id: "profile-1", username: "riley", display_name: "Riley Riff", avatar_url: null },
};

beforeEach(() => {
  queryState = { data: [event], isLoading: false, isError: false, error: null };
});

describe("BandContributionsTab", () => {
  it("renders recent contributions and member summary", () => {
    render(<BandContributionsTab bandId="band-1" />);

    expect(screen.getByText("Recent contributions")).toBeInTheDocument();
    expect(screen.getAllByText("Riley Riff").length).toBeGreaterThan(0);
    expect(screen.getByText("Rehearsal attendance")).toBeInTheDocument();
    expect(screen.getByText("Member summary")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    queryState = { data: [], isLoading: false, isError: false, error: null };
    render(<BandContributionsTab bandId="band-1" />);

    expect(screen.getByText(/No contribution events have been recorded yet/i)).toBeInTheDocument();
  });

  it("renders backend error state", () => {
    queryState = { data: undefined, isLoading: false, isError: true, error: new Error("denied") };
    render(<BandContributionsTab bandId="band-1" />);

    expect(screen.getByText("Unable to load participation history")).toBeInTheDocument();
    expect(screen.getByText("denied")).toBeInTheDocument();
  });

  it("renders loading state", () => {
    queryState = { data: undefined, isLoading: true, isError: false, error: null };
    const { container } = render(<BandContributionsTab bandId="band-1" />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders unsupported contribution type fallback", () => {
    queryState = { data: [{ ...event, contribution_type: "future_type", metadata: {} }], isLoading: false, isError: false, error: null };
    render(<BandContributionsTab bandId="band-1" />);

    expect(screen.getByText("Band activity")).toBeInTheDocument();
  });
});
