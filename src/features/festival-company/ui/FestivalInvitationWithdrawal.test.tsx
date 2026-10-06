import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FestivalArtistOpportunitiesPage from "./FestivalArtistOpportunitiesPage";

const state = vi.hoisted(() => ({
  status: "interested",
  managed: true,
  pending: false,
  withdraw: vi.fn(),
}));
const bandId = "11111111-1111-4111-8111-111111111111";
const invitationId = "22222222-2222-4222-8222-222222222222";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [{ id: bandId, name: "Shockmaster" }] }),
}));
vi.mock("../application/useFestivalArtistWorkflows", () => ({
  useFestivalArtistOpportunities: () => ({
    data: {
      openApplications: [], applications: [], offers: [], bookings: [],
      invitations: [{ id: invitationId, artist_type: "band", band_id: bandId, status: state.status, version: 3 }],
      permissions: { profileId: bandId, canApplySolo: false, managedBandIds: state.managed ? [bandId] : [] },
    },
  }),
  useFestivalArtistAction: (action: string) => ({
    isPending: action === "withdrawInvitation" && state.pending,
    mutateAsync: action === "withdrawInvitation" ? state.withdraw : vi.fn(),
  }),
}));

const open = () => render(<MemoryRouter><FestivalArtistOpportunitiesPage /></MemoryRouter>);

describe("real-band festival invitation withdrawal", () => {
  beforeEach(() => {
    state.status = "interested";
    state.managed = true;
    state.pending = false;
    state.withdraw.mockReset().mockResolvedValue({});
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("confirms withdrawal with invitation version and shows success", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw interest" }));
    await waitFor(() => expect(state.withdraw).toHaveBeenCalledWith({
      p_invitation_id: invitationId, p_expected_version: 3, p_idempotency_key: expect.any(String),
    }));
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(await screen.findByText("Festival invitation interest withdrawn.")).toBeTruthy();
  });

  it("does nothing when confirmation is cancelled", () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw interest" }));
    expect(state.withdraw).not.toHaveBeenCalled();
  });

  it.each(["cancelled", "converted_to_offer", "declined", "expired"])("does not offer withdrawal for %s invitations", (status) => {
    state.status = status;
    open();
    expect(screen.queryByRole("button", { name: "Withdraw interest" })).toBeNull();
  });

  it("hides withdrawal from characters who cannot represent the band", () => {
    state.managed = false;
    open();
    expect(screen.queryByRole("button", { name: "Withdraw interest" })).toBeNull();
  });

  it("blocks repeat clicks while withdrawing", () => {
    state.pending = true;
    open();
    expect(screen.getByRole("button", { name: "Withdrawing…" }).hasAttribute("disabled")).toBe(true);
  });

  it("shows an error when withdrawal fails", async () => {
    state.withdraw.mockRejectedValue(new Error("festival_artist_action_forbidden"));
    open();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw interest" }));
    expect(await screen.findByText("You are not authorised to take that Festival action.")).toBeTruthy();
    expect(screen.queryByText("Festival invitation interest withdrawn.")).toBeNull();
  });
});