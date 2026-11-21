import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FestivalArtistOpportunitiesPage from "./FestivalArtistOpportunitiesPage";

const bandId = "11111111-1111-4111-8111-111111111111";
const bookingId = "33333333-3333-4333-8333-333333333333";
const state = vi.hoisted(() => ({
  status: "confirmed",
  managed: true,
  pending: false,
  provisionalDate: "2099-10-01",
  scheduledStart: "",
  artistType: "band",
  cancel: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [{ id: bandId, name: "Shockmaster" }] }),
}));
vi.mock("./FestivalBookingPreparation", () => ({ FestivalBookingPreparation: () => null }));
vi.mock("../application/useFestivalArtistWorkflows", () => ({
  useFestivalArtistOpportunities: () => ({
    data: {
      openApplications: [], applications: [], invitations: [], offers: [],
      bookings: [{
        id: bookingId, status: state.status, version: 7, artist_type: state.artistType,
        artist_profile_id: bandId, band_id: bandId, starts_at: state.scheduledStart,
        provisional_date: state.provisionalDate, agreed_fee_minor: 50000, currency_code: "GBP",
      }],
      permissions: { profileId: bandId, canApplySolo: false, managedBandIds: state.managed ? [bandId] : [] },
    },
  }),
  useFestivalArtistAction: (action: string) => ({
    isPending: action === "cancelBooking" && state.pending,
    mutateAsync: action === "cancelBooking" ? state.cancel : vi.fn(),
  }),
}));

const open = () => render(<MemoryRouter><FestivalArtistOpportunitiesPage /></MemoryRouter>);

describe("Festival gig cancellation", () => {
  beforeEach(() => {
    state.status = "confirmed";
    state.managed = true;
    state.pending = false;
    state.provisionalDate = "2099-10-01";
    state.scheduledStart = "";
    state.artistType = "band";
    state.cancel.mockReset().mockResolvedValue({});
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("confirms a booking withdrawal and uses the server's versioned cancellation action", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel festival gig" }));
    await waitFor(() => expect(state.cancel).toHaveBeenCalledWith({
      p_booking_id: bookingId,
      p_reason: "Withdrawn by artist",
      p_expected_version: 7,
      p_idempotency_key: expect.any(String),
    }));
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(await screen.findByText(/Festival gig cancelled/)).toBeTruthy();
  });

  it("keeps the booking when the player declines confirmation", () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel festival gig" }));
    expect(state.cancel).not.toHaveBeenCalled();
  });

  it.each(["artist_withdrawn", "festival_cancelled", "completed", "cancelled"])(
    "does not allow cancellation of %s bookings", (status) => {
      state.status = status;
      open();
      expect(screen.queryByRole("button", { name: "Cancel festival gig" })).toBeNull();
    },
  );

  it("hides withdrawal for artists without band management authority", () => {
    state.managed = false;
    open();
    expect(screen.queryByRole("button", { name: "Cancel festival gig" })).toBeNull();
  });

  it("allows withdrawal of a stale confirmed booking whose provisional festival date is past", () => {
    state.provisionalDate = "2020-10-01";
    open();
    expect(screen.getByRole("button", { name: "Cancel festival gig" })).toBeTruthy();
  });

  it("allows solo performers to cancel their own confirmed booking", () => {
    state.artistType = "solo";
    state.managed = false;
    open();
    expect(screen.getByRole("button", { name: "Cancel festival gig" })).toBeTruthy();
  });

  it("does not offer cancellation after a scheduled performance has started", () => {
    state.status = "scheduled";
    state.scheduledStart = "2020-10-01T17:00:00Z";
    open();
    expect(screen.queryByRole("button", { name: "Cancel festival gig" })).toBeNull();
  });

  it("reserves cancellation of future scheduled performances for the canonical stage workflow", () => {
    state.status = "scheduled";
    state.scheduledStart = "2099-10-01T17:00:00Z";
    open();
    expect(screen.queryByRole("button", { name: "Cancel festival gig" })).toBeNull();
  });

  it("prevents duplicate cancellation requests", () => {
    state.pending = true;
    open();
    expect(screen.getByRole("button", { name: "Cancelling…" }).hasAttribute("disabled")).toBe(true);
  });

  it("reports a stale booking without claiming cancellation", async () => {
    state.cancel.mockRejectedValue(new Error("festival_artist_offer_stale"));
    open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel festival gig" }));
    expect(await screen.findByText("That Festival offer changed. Refresh and review the latest terms.")).toBeTruthy();
    expect(screen.queryByText(/Festival gig cancelled/)).toBeNull();
  });
});
