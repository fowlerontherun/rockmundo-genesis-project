import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let rehearsalQuery: any;
let gigQuery: any;
let correctionsQuery: any;

vi.mock("@/hooks/useParticipationDetails", () => ({
  useRehearsalParticipants: () => rehearsalQuery,
  useGigPerformers: () => gigQuery,
  useRehearsalAttendanceCorrectionRequests: () => correctionsQuery,
}));

import { GigPerformersSection, RehearsalParticipantsSection } from "./ParticipantStatusList";

const profile = { id: "profile-1", username: "riley", display_name: "Riley Riff", avatar_url: null };
const rehearsalRow = { id: "rp-1", rehearsal_id: "reh-1", band_id: "band-1", profile_id: "profile-1", participation_status: "invited", profiles: profile };
const gigRow = { id: "gp-1", gig_id: "gig-1", band_id: "band-1", profile_id: "profile-1", role_or_instrument: "Guitar", lineup_status: "selected", profiles: profile };

beforeEach(() => {
  rehearsalQuery = { data: [rehearsalRow], isLoading: false, isError: false, error: null };
  gigQuery = { data: [gigRow], isLoading: false, isError: false, error: null };
  correctionsQuery = { data: [], isLoading: false, isError: false, error: null };
});

describe("RehearsalParticipantsSection", () => {
  it("renders upcoming expected participants without edit controls", () => {
    render(<RehearsalParticipantsSection rehearsalId="reh-1" />);
    expect(screen.getByRole("heading", { name: /rehearsal attendance/i })).toBeInTheDocument();
    expect(screen.getByText("Riley Riff")).toBeInTheDocument();
    expect(screen.getByLabelText("Riley Riff status: Expected")).toBeInTheDocument();
    expect(screen.getByText(/included automatically/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders completed attended and missed participants", () => {
    rehearsalQuery.data = [
      { ...rehearsalRow, participation_status: "attended" },
      { ...rehearsalRow, id: "rp-2", profile_id: "profile-2", participation_status: "missed", profiles: { ...profile, id: "profile-2", display_name: "Mika Miss" } },
    ];
    render(<RehearsalParticipantsSection rehearsalId="reh-1" completed />);
    expect(screen.getByLabelText("Riley Riff status: Attended")).toBeInTheDocument();
    expect(screen.getByLabelText("Mika Miss status: Missed")).toBeInTheDocument();
  });

  it("renders empty, unavailable, backend error, and loading states", () => {
    rehearsalQuery = { data: [], isLoading: false, isError: false, error: null };
    const { rerender, container } = render(<RehearsalParticipantsSection rehearsalId="reh-1" />);
    expect(screen.getByText(/No participant rows/i)).toBeInTheDocument();

    rerender(<RehearsalParticipantsSection rehearsalId="reh-1" completed />);
    expect(screen.getByText(/unavailable for this older event/i)).toBeInTheDocument();

    rehearsalQuery = { data: undefined, isLoading: false, isError: true, error: new Error("denied") };
    rerender(<RehearsalParticipantsSection rehearsalId="reh-1" />);
    expect(screen.getByText(/Unable to load rehearsal attendance/i)).toBeInTheDocument();

    rehearsalQuery = { data: undefined, isLoading: true, isError: false, error: null };
    rerender(<RehearsalParticipantsSection rehearsalId="reh-1" />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
  it("renders manager correction history and conflict guidance", () => {
    rehearsalQuery.data = [{ ...rehearsalRow, participation_status: "attended" }];
    correctionsQuery.data = [
      {
        id: "corr-1",
        rehearsal_id: "reh-1",
        participant_id: "rp-1",
        band_id: "band-1",
        requester_profile_id: "profile-1",
        current_status: "attended",
        requested_status: "missed",
        request_reason: "Marked the wrong rehearsal",
        status: "pending",
        created_at: new Date().toISOString(),
        resolved_at: null,
        resolved_by_profile_id: null,
        resolution_note: null,
        profiles: profile,
        eligibility: { denial_reason: "original_finaliser_conflict", can_resolve: false },
      },
      {
        id: "corr-2",
        rehearsal_id: "reh-1",
        participant_id: "rp-1",
        band_id: "band-1",
        requester_profile_id: "profile-1",
        current_status: "missed",
        requested_status: "attended",
        request_reason: null,
        status: "approved",
        created_at: new Date().toISOString(),
        resolved_at: new Date().toISOString(),
        resolved_by_profile_id: "manager-2",
        resolution_note: "verified",
        sole_resolver_exception: true,
        profiles: profile,
      },
    ];
    render(<RehearsalParticipantsSection rehearsalId="reh-1" isManager />);
    expect(screen.getByText(/Another authorised manager must resolve this request/i)).toBeInTheDocument();
    expect(screen.getByText(/Correction history/i)).toBeInTheDocument();
    expect(screen.getByText(/sole-resolver exception/i)).toBeInTheDocument();
  });
});

describe("GigPerformersSection", () => {
  it("renders upcoming selected lineup without edit controls", () => {
    render(<GigPerformersSection gigId="gig-1" />);
    expect(screen.getByRole("heading", { name: /lineup/i })).toBeInTheDocument();
    expect(screen.getByText("Guitar")).toBeInTheDocument();
    expect(screen.getByLabelText("Riley Riff status: Selected")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders completed performed/missed and cancelled selected rows as recorded", () => {
    gigQuery.data = [
      { ...gigRow, lineup_status: "performed" },
      { ...gigRow, id: "gp-2", profile_id: "profile-2", lineup_status: "missed", profiles: { ...profile, id: "profile-2", display_name: "Mika Miss" } },
      { ...gigRow, id: "gp-3", profile_id: "profile-3", lineup_status: "selected", profiles: { ...profile, id: "profile-3", display_name: "Casey Cancel" } },
    ];
    render(<GigPerformersSection gigId="gig-1" completedOrCancelled />);
    expect(screen.getByLabelText("Riley Riff status: Performed")).toBeInTheDocument();
    expect(screen.getByLabelText("Mika Miss status: Missed")).toBeInTheDocument();
    expect(screen.getByLabelText("Casey Cancel status: Selected")).toBeInTheDocument();
  });

  it("renders empty, unavailable, backend error, and loading states", () => {
    gigQuery = { data: [], isLoading: false, isError: false, error: null };
    const { rerender, container } = render(<GigPerformersSection gigId="gig-1" />);
    expect(screen.getByText(/No lineup rows/i)).toBeInTheDocument();

    rerender(<GigPerformersSection gigId="gig-1" completedOrCancelled />);
    expect(screen.getByText(/unavailable for this older event/i)).toBeInTheDocument();

    gigQuery = { data: undefined, isLoading: false, isError: true, error: new Error("denied") };
    rerender(<GigPerformersSection gigId="gig-1" />);
    expect(screen.getByText(/Unable to load lineup/i)).toBeInTheDocument();

    gigQuery = { data: undefined, isLoading: true, isError: false, error: null };
    rerender(<GigPerformersSection gigId="gig-1" />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
