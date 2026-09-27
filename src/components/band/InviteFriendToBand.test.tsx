import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  toast: vi.fn(),
  searchPublicProfiles: vi.fn(),
  sendBandInvitation: vi.fn(),
  cancelBandInvitation: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/useBandInvitationsRealtime", () => ({ useBandInvitationsRealtime: vi.fn() }));
vi.mock("@/services/publicProfileSearch", () => ({ searchPublicProfiles: mocks.searchPublicProfiles }));
vi.mock("@/services/bandInvitations", () => ({
  sendBandInvitation: mocks.sendBandInvitation,
  cancelBandInvitation: mocks.cancelBandInvitation,
  friendlyBandInvitationError: (error: Error) => error.message,
}));

import { InviteFriendToBand } from "./InviteFriendToBand";
import { useBandInvitationsRealtime } from "@/hooks/useBandInvitationsRealtime";

const bandId = "11111111-1111-4111-8111-111111111111";
const inviterProfileId = "22222222-2222-4222-8222-222222222222";
const inviterUserId = "33333333-3333-4333-8333-333333333333";
const targetProfileId = "44444444-4444-4444-8444-444444444444";
const targetUserId = "55555555-5555-4555-8555-555555555555";
const player = {
  id: targetProfileId,
  user_id: targetUserId,
  username: "guestguitarist",
  display_name: "Guest Guitarist",
  avatar_url: null,
  bio: null,
  fame: 10,
  fans: 0,
  level: 2,
  city_name: "London",
  bands: [],
};

let dataByTable: Record<string, unknown[]>;
let errorsByTable: Record<string, { message: string } | null>;

function query(table: string) {
  const result = () => ({ data: dataByTable[table] || [], error: errorsByTable[table] || null });
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    in: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (value: ReturnType<typeof result>) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve, reject),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.or.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

async function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Invite Player" }));
  return screen.findByLabelText("Find a player");
}

beforeEach(() => {
  vi.clearAllMocks();
  dataByTable = {
    friendships: [],
    band_invitations: [],
    band_members: [{ user_id: inviterUserId }],
    profiles: [],
  };
  errorsByTable = {};
  mocks.from.mockImplementation((table: string) => query(table));
  mocks.searchPublicProfiles.mockResolvedValue([player]);
  mocks.sendBandInvitation.mockResolvedValue({ id: "66666666-6666-4666-8666-666666666666", status: "pending" });
  mocks.cancelBandInvitation.mockResolvedValue({ status: "cancelled" });
});

describe("Band Members player invitations", () => {
  it("refreshes pending invitations when the invited player responds while the dialog is open", async () => {
    render(<InviteFriendToBand bandId={bandId} bandName="The Testers" currentUserId={inviterProfileId} currentAccountId={inviterUserId} />);
    await openDialog();
    await screen.findByText("No pending invitations.");
    const realtime = vi.mocked(useBandInvitationsRealtime).mock.calls.at(-1)?.[0];
    expect(realtime?.filterColumn).toBe("band_id");
    expect(realtime?.filterValue).toBe(bandId);

    dataByTable.band_invitations = [{
      id: "66666666-6666-4666-8666-666666666666",
      invited_user_id: targetUserId,
      invited_profile_id: targetProfileId,
      instrument_role: "Guitar",
      status: "declined",
      created_at: "2026-09-26T00:00:00Z",
      responded_at: "2026-09-27T00:00:00Z",
    }];
    dataByTable.profiles = [{ id: targetProfileId, user_id: targetUserId, display_name: "Guest Guitarist", username: "guestguitarist" }];
    act(() => realtime?.onChange({ eventType: "UPDATE", status: "declined" }));
    expect(await screen.findByText("Declined")).toBeInTheDocument();
    expect(screen.getByText("Guest Guitarist")).toBeInTheDocument();
  });

  it("searches and invites non-friends through the guarded invitation service", async () => {
    render(<InviteFriendToBand bandId={bandId} bandName="The Testers" currentUserId={inviterProfileId} currentAccountId={inviterUserId} />);
    const input = await openDialog();
    fireEvent.change(input, { target: { value: "guest" } });

    await waitFor(() => expect(mocks.searchPublicProfiles).toHaveBeenCalledWith("guest", inviterProfileId, 20));
    fireEvent.click(await screen.findByRole("button", { name: /Guest Guitarist.*guestguitarist/i }));
    expect(screen.getByText("Inviting:")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send Invitation" }));

    await waitFor(() => expect(mocks.sendBandInvitation).toHaveBeenCalledWith(expect.objectContaining({
      bandId,
      targetProfileId,
    })));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invitation sent!" }));
    expect(screen.getByRole("button", { name: "Send Invitation" })).toBeDisabled();
  });

  it("disables pending invitees and allows their invitation to be cancelled", async () => {
    dataByTable.band_invitations = [{
      id: "66666666-6666-4666-8666-666666666666",
      invited_user_id: targetUserId,
      invited_profile_id: targetProfileId,
      instrument_role: "Guitar",
      created_at: "2026-09-26T00:00:00Z",
      status: "pending",
      responded_at: null,
    }];
    dataByTable.profiles = [{ id: targetProfileId, user_id: targetUserId, display_name: "Guest Guitarist", username: "guestguitarist" }];

    render(<InviteFriendToBand bandId={bandId} bandName="The Testers" currentUserId={inviterProfileId} currentAccountId={inviterUserId} />);
    const input = await openDialog();
    fireEvent.change(input, { target: { value: "guest" } });
    await waitFor(() => expect(mocks.searchPublicProfiles).toHaveBeenCalled());

    const option = await screen.findByRole("button", { name: /Guest Guitarist.*Invitation pending/i });
    expect(option).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send Invitation" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(mocks.cancelBandInvitation).toHaveBeenCalledWith("66666666-6666-4666-8666-666666666666"));
  });

  it("shows resolved invitations with their final status without disabling an eligible search result", async () => {
    dataByTable.band_invitations = [
      {
        id: "66666666-6666-4666-8666-666666666666",
        invited_user_id: targetUserId,
        invited_profile_id: targetProfileId,
        instrument_role: "Guitar",
        status: "accepted",
        created_at: "2026-09-25T00:00:00Z",
        responded_at: "2026-09-26T00:00:00Z",
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        invited_user_id: "88888888-8888-4888-8888-888888888888",
        invited_profile_id: "99999999-9999-4999-8999-999999999999",
        instrument_role: "Bass",
        status: "declined",
        created_at: "2026-09-25T00:00:00Z",
        responded_at: "2026-09-26T01:00:00Z",
      },
    ];
    dataByTable.profiles = [{ id: targetProfileId, user_id: targetUserId, display_name: "Guest Guitarist", username: "guestguitarist" }];
    render(<InviteFriendToBand bandId={bandId} bandName="The Testers" currentUserId={inviterProfileId} currentAccountId={inviterUserId} />);
    await openDialog();
    expect(await screen.findByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("Declined")).toBeInTheDocument();
    expect(screen.getByText("Guest Guitarist")).toBeInTheDocument();
    expect(screen.getByText("No pending invitations.")).toBeInTheDocument();
  });

  it("keeps player search available when optional friends cannot load and clears stale selections on close", async () => {
    errorsByTable.friendships = { message: "Friendships unavailable" };
    render(<InviteFriendToBand bandId={bandId} bandName="The Testers" currentUserId={inviterProfileId} currentAccountId={inviterUserId} />);
    const input = await openDialog();
    fireEvent.change(input, { target: { value: "guest" } });
    fireEvent.click(await screen.findByRole("button", { name: /Guest Guitarist.*guestguitarist/i }));

    fireEvent.click(screen.getByRole("button", { name: "Close invitation dialog" }));
    await openDialog();
    expect(screen.getByRole("button", { name: "Send Invitation" })).toBeDisabled();
    expect(screen.getByLabelText("Find a player")).toHaveValue("");
  });
});
